import { useEffect, useState } from "react";
import { sb } from "./supabase.js";

// Almacén compartido entre dispositivos (cliente <-> prestador).
// Con el servidor de demo (server.js) los datos viajan por HTTP + SSE, así que dos celulares distintos
// ven los mismos cambios en tiempo real. Si no hay servidor (p. ej. un hosting estático), cae a
// localStorage y solo sincroniza entre pestañas del mismo navegador.
// Si hay credenciales de Supabase (.env), los datos viven en la nube (supabase.js) y los dos celulares
// pueden estar en redes distintas: se sincronizan consultando la tabla cada ~2 s.
const KEYS = { requests: "id", messages: "id", calls: "reqId", providerCfg: "id", ratings: "reqId", photos: "id", providers: "id" };
const LS_PREFIX = "fw:shared:";
let online = false;
const cols = {};

const lsRead = (name) => { try { const v = JSON.parse(window.localStorage.getItem(LS_PREFIX + name)); return Array.isArray(v) ? v : []; } catch { return []; } };
const lsWrite = (name, list) => { try { window.localStorage.setItem(LS_PREFIX + name, JSON.stringify(list)); } catch { /* cuota o modo privado */ } };

// Los POST se encolan para conservar el orden de las escrituras de este dispositivo.
let queue = Promise.resolve();
const enqueue = (run) => { const p = queue.then(run, run); queue = p.catch(() => {}); return p; };
const post = (path, body, method = "POST") => enqueue(() => fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
  .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }));

// Supabase: mientras haya escrituras en vuelo se ignoran las lecturas, para que una consulta vieja no "revierta" lo recién escrito.
let writeSeq = 0, inflight = 0, syncNow = () => {};
const sbWrite = (name, diff) => {
  writeSeq++; inflight++;
  return enqueue(() => sb.write(name, KEYS[name], diff)).finally(() => { inflight--; if (!inflight) syncNow(); });
};

function collection(name) {
  const key = KEYS[name];
  const subs = new Set();
  let cache = lsRead(name);
  const notify = () => subs.forEach((f) => f());
  const rd = () => cache;
  const set = (list) => { cache = list; lsWrite(name, list); notify(); };
  const wr = (next) => {
    const prev = cache;
    set(next);
    if (!online) return;
    // Se envían solo los elementos que cambiaron: dos dispositivos escribiendo a la vez no se pisan.
    const before = new Map(prev.map((x) => [String(x[key]), JSON.stringify(x)]));
    const after = new Set(next.map((x) => String(x[key])));
    const upserts = next.filter((x) => before.get(String(x[key])) !== JSON.stringify(x));
    const deletes = [...before.keys()].filter((k) => !after.has(k));
    if (upserts.length || deletes.length) (sb ? sbWrite(name, { upserts, deletes }) : post(`/api/col/${name}`, { upserts, deletes })).catch(() => { online = false; });
  };
  const use = () => {
    const [l, setL] = useState(rd);
    useEffect(() => { const f = () => setL(rd()); subs.add(f); f(); return () => subs.delete(f); }, []);
    return l;
  };
  // Sin servidor: sincroniza pestañas del mismo navegador.
  window.addEventListener("storage", (e) => { if (!online && e.key === LS_PREFIX + name) { cache = lsRead(name); notify(); } });
  cols[name] = { set, wr, rd };
  return { rd, wr, set, use };
}

const requests = collection("requests");
const msgs = collection("messages");
const calls = collection("calls");
const provCfg = collection("providerCfg");   // [{ id, available, schedule }]
const ratingsCol = collection("ratings");    // [{ reqId, providerId, avg, answers, comment, ts }]
const providersCol = collection("providers"); // prestadores registrados [{ id, nombre, telefono, pin, curp, zona, services, verified, ts }]
const photosCol = collection("photos");      // [{ id, reqId, providerId, url, ts }]

// Nube (Supabase): consulta periódica de todo el estado; solo notifica a la UI si algo cambió.
function connectSupabase() {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  syncNow = () => {
    const seq = writeSeq;
    return sb.fetchState().then((state) => {
      if (inflight > 0 || seq !== writeSeq) return; // hubo escrituras mientras consultaba: esta lectura ya es vieja
      online = true;
      Object.keys(KEYS).forEach((n) => { const next = Array.isArray(state[n]) ? state[n] : []; if (!same(next, cols[n].rd())) cols[n].set(next); });
    }).catch(() => { online = false; });
  };
  syncNow();
  setInterval(() => { if (!document.hidden) syncNow(); }, 2000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncNow(); });
}

function connect() {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  if (sb) return connectSupabase();
  const sync = () => fetch("/api/state").then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((state) => { online = true; Object.keys(KEYS).forEach((n) => cols[n].set(Array.isArray(state[n]) ? state[n] : [])); })
    .catch(() => { online = false; });
  sync();
  if (typeof EventSource === "undefined") return;
  const es = new EventSource("/api/events");
  es.addEventListener("col", (e) => { try { const { name, list } = JSON.parse(e.data); if (cols[name]) { online = true; cols[name].set(list); } } catch { /* ignorar */ } });
  es.onopen = sync; // al reconectar, se vuelve a traer todo el estado
}
connect();

// ¿Hay servidor conectado? (útil para avisar al usuario)
export const isOnline = () => online;

export const saveRequest = (r) => requests.wr([...requests.rd().filter((x) => x.id !== r.id), { step: 0, status: "pending", createdAt: Date.now(), ...r }].slice(-100));
export const updateRequest = (id, patch) => requests.wr(requests.rd().map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)));
export const useRequests = requests.use;
// Ubicación en vivo del prestador (la lee el cliente en el mapa). No modifica updatedAt.
export const setProviderLoc = (id, loc) => requests.wr(requests.rd().map((x) => (x.id === id ? { ...x, providerLoc: loc } : x)));

// Ubicación en vivo del cliente (la lee el prestador en su mapa). No modifica updatedAt.
export const setClientLoc = (id, loc) => requests.wr(requests.rd().map((x) => (x.id === id ? { ...x, clientLoc: loc } : x)));

/* ---- Mensajes y llamadas (simulados; una llamada real requiere WebRTC + servidor) ---- */
export const sendMessage = (reqId, from, text) =>
  msgs.wr([...msgs.rd(), { id: Date.now() + Math.random(), reqId, from, text: text.trim().slice(0, 500), ts: Date.now() }].slice(-300));
export const useAllMessages = () => msgs.use();
export const useCalls = () => calls.use();
export const startCall = (reqId, from) => calls.wr([...calls.rd().filter((c) => c.reqId !== reqId), { reqId, from, status: "ringing", ts: Date.now() }]);
export const updateCall = (reqId, patch) => calls.wr(calls.rd().map((c) => (c.reqId === reqId ? { ...c, ...patch } : c)));

/* ---- Agenda/disponibilidad del prestador y calificaciones (compartidas cliente <-> prestador) ---- */
export const useProviderCfgs = () => provCfg.use();
export const setProviderCfg = (id, patch) => {
  const l = provCfg.rd();
  provCfg.wr(l.some((c) => c.id === id) ? l.map((c) => (c.id === id ? { ...c, ...patch } : c)) : [...l, { id, ...patch }]);
};
export const useRatings = () => ratingsCol.use();
// Una calificación por solicitud: si se vuelve a enviar, reemplaza la anterior.
export const saveRating = (r) => ratingsCol.wr([...ratingsCol.rd().filter((x) => x.reqId !== r.reqId), { ...r, ts: Date.now() }].slice(-500));

/* ---- Fotos del servicio (las sube el prestador, las ve el cliente) ---- */
export const MAX_PHOTOS = 4;
export const usePhotos = () => photosCol.use();
// Con servidor: la imagen se guarda en disco y se comparte la URL. Sin servidor: se guarda en el navegador.
export async function uploadPhoto(reqId, providerId, dataUrl) {
  if (sb && online) {
    if (photosCol.rd().filter((p) => p.reqId === reqId).length >= MAX_PHOTOS) throw new Error(`Máximo ${MAX_PHOTOS} fotos por servicio.`);
    const up = await sb.uploadPhoto(dataUrl).catch(() => { throw new Error("No se pudo subir la foto. Revisa la conexión."); });
    const photo = { ...up, reqId, providerId, ts: Date.now() };
    photosCol.wr([...photosCol.rd(), photo]);
    return photo;
  }
  if (online) return post("/api/photos", { reqId, providerId, dataUrl }).catch(() => { throw new Error("No se pudo subir la foto. Revisa la conexión con el servidor."); });
  const list = photosCol.rd();
  if (list.filter((p) => p.reqId === reqId).length >= MAX_PHOTOS) throw new Error(`Máximo ${MAX_PHOTOS} fotos por servicio.`);
  photosCol.wr([...list, { id: `${Date.now()}`, reqId, providerId, url: dataUrl, ts: Date.now() }]);
}
export async function deletePhoto(id) {
  if (sb && online) {
    const p = photosCol.rd().find((x) => x.id === id);
    photosCol.wr(photosCol.rd().filter((x) => x.id !== id));
    if (p?.file) sb.removeFile(p.file).catch(() => {});
    return;
  }
  if (online) { photosCol.set(photosCol.rd().filter((p) => p.id !== id)); return post(`/api/photos/${id}`, null, "DELETE"); }
  photosCol.wr(photosCol.rd().filter((p) => p.id !== id));
}
// Reinicia los datos compartidos de la demostración (solicitudes, mensajes, fotos…).
export async function resetDemo() {
  if (sb && online) {
    writeSeq++; // invalida lecturas en curso
    await sb.reset();
    Object.keys(KEYS).filter((n) => n !== "providers").forEach((n) => cols[n].set([]));
    return;
  }
  if (online) await post("/api/reset", {});
  else Object.keys(KEYS).filter((n) => n !== "providers").forEach((n) => cols[n].set([]));
}

/* ---- Prestadores registrados (demo: sin autenticación real; el PIN se guarda en claro) ---- */
export const useProviders = () => providersCol.use();
export const registerProvider = (p) => {
  const id = Date.now();
  providersCol.wr([...providersCol.rd(), { ...p, id, verified: true, ts: id }].slice(-100));
  return id;
};
// Prestador registrado → mismo formato que los de TEAM en App.jsx (calificación 0 = "Nuevo").
export const providerToMember = (p) => ({ id: p.id, name: p.nombre, phone: p.telefono, zone: p.zona, rating: 0, reviews: 0, services: p.services, years: 0, days: [0, 1, 2, 3, 4, 5], from: 8, to: 18, registered: true });

export const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const hh = (n) => `${String(n).padStart(2, "0")}:00`;
// Horario por defecto de un prestador (días 0=lun … 6=dom, from/to en horas)
export const defaultSchedule = (m) => DAY_NAMES.map((d, i) => ({ d, on: m.days.includes(i), from: hh(m.from), to: hh(m.to) }));

// Promedio ponderado: la calificación base del prestador cuenta como `seedCount` reseñas previas.
export const blendRating = (seedAvg, seedCount, list) => {
  const total = seedCount + list.length;
  return { avg: total ? (seedAvg * seedCount + list.reduce((s, r) => s + r.avg, 0)) / total : seedAvg, count: total };
};
// Prestador "en vivo": datos base + agenda/disponibilidad y calificaciones compartidas.
export const liveMember = (m, cfgs, ratings) => {
  const c = cfgs.find((x) => x.id === m.id);
  const { avg, count } = blendRating(m.rating, m.reviews ?? 0, ratings.filter((r) => r.providerId === m.id));
  return { ...m, schedule: c?.schedule ?? defaultSchedule(m), available: c?.available ?? true, rating: avg, reviews: count };
};
