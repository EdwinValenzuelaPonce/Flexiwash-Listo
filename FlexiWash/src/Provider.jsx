import React, { useRef, useState } from "react";
import { useRequests, updateRequest, setProviderLoc, useAllMessages, startCall, setProviderCfg, useRatings, defaultSchedule, usePhotos, uploadPhoto, deletePhoto, MAX_PHOTOS } from "./store.js";
import { compressImage } from "./photos.js";
import { useGeolocation, distKm } from "./geo.js";
import { ProviderMap } from "./TrackingMap.jsx";
import { ChatView, CallView, useIncomingCall } from "./Comms.jsx";
import SupportChat from "./Support.jsx";
import { BadgeRow, providerBadges } from "./badges.jsx";
import { usePersistentState } from "./usePersistentState.js";
import {
  ChevronLeft, X, MapPin, Wallet, Clock, User, CheckCircle2, CalendarDays,
  History, MessageCircle, Headphones, Phone, Home as HomeIcon, Car, Sofa, Landmark, Camera, Plus, Trash2
} from "lucide-react";

const COMMISSION = 0.15;      // comisión FlexiWash sobre el precio del servicio
const MIN_WITHDRAW = 100;
const STEPS = ["Aceptado", "En camino", "En proceso", "Finalizado"];
const ICONS = { Autos: Car, Hogar: HomeIcon, Muebles: Sofa };
const HOURS = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = (n) => fmt.format(n);
const net = (price) => Math.round(price * (1 - COMMISSION) * 100) / 100;

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const BASE_BALANCE = 4850;
const JOBS = [
  { id: 288, category: "Autos", service: "Lavado Premium", price: 220, date: "2026-09-27", rating: 5 },
  { id: 281, category: "Hogar", service: "Limpieza básica", price: 350, date: "2026-09-26", rating: 5 },
  { id: 275, category: "Muebles", service: "Colchón", price: 250, date: "2026-09-25", rating: 4 },
];
const CSS = `
.fwp-root{display:flex;flex-direction:column;flex:1;min-height:0}.fwp-scroll{flex:1;min-height:0;overflow-y:auto;padding-bottom:20px}
.fwp-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fwp-acts button{display:flex;align-items:center;justify-content:center;gap:6px}
.fwp-conv{display:flex;align-items:center;gap:10px;width:100%;text-align:left;font:inherit;background:#fff;border:1px solid var(--fw-line);border-radius:14px;padding:12px;cursor:pointer}
.fwp-conv>div{flex:1;min-width:0}.fwp-conv small{display:block;color:var(--fw-ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fwp-conv .fwp-call{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--fw-line);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.fw-bottomnav .fw-navitem{position:relative}.fw-bottomnav .fw-navitem span:not(.fw-badge){font-size:10px}
.fwp-chips{display:flex;gap:6px;flex-wrap:wrap}
.fwp-chip{border:1px solid var(--fw-line);background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;font-weight:700;color:var(--fw-ink-soft);cursor:pointer}
.fwp-chip.is-on{background:var(--fw-teal);border-color:var(--fw-teal);color:#fff}
.fwp-day{display:grid;grid-template-columns:44px 48px 1fr;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--fw-line)}
.fwp-day:last-child{border:none}.fwp-day select{font:inherit;font-size:12px;padding:6px;border:1px solid var(--fw-line);border-radius:8px;background:#fff}
.fwp-day.is-off .fwp-times{opacity:.35;pointer-events:none}.fwp-times{display:flex;gap:6px;align-items:center;font-size:12px}
.fwp-err{color:var(--fw-error);font-size:12px;margin:0}.fwp-ok{color:var(--fw-success);font-size:12px;font-weight:700;margin:0}
.fwp-photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fwp-ph{position:relative;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:#eef3f2;border:1.5px dashed var(--fw-line);display:flex;align-items:center;justify-content:center;color:var(--fw-ink-soft)}
.fwp-ph.has{border:none;background:#000}.fwp-ph img{width:100%;height:100%;object-fit:cover;display:block}
.fwp-ph .fwp-n{position:absolute;top:6px;left:6px;background:var(--fw-teal);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:5px}
.fwp-ph .fwp-del{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.fwp-add{font:inherit;font-size:12px;font-weight:700;color:var(--fw-teal-dark);background:#fff;border:1.5px dashed var(--fw-teal);cursor:pointer;flex-direction:column;gap:4px}
.fwp-add:disabled{opacity:.6;cursor:progress}
.fwp-col{display:flex;flex-direction:column;gap:10px}.fwp-label{font-size:12px;font-weight:700;color:var(--fw-ink-soft)}
`;

// Fotos del servicio: el prestador las toma/elige y el cliente las ve en su pantalla de seguimiento.
function PhotoSlots({ reqId, providerId }) {
  const photos = usePhotos().filter((p) => p.reqId === reqId).sort((a, b) => a.ts - b.ts);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef(null);
  const onPick = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true); setErr("");
    try {
      let count = photos.length;
      for (const f of files) {
        if (count >= MAX_PHOTOS) { setErr(`Máximo ${MAX_PHOTOS} fotos por servicio.`); break; }
        await uploadPhoto(reqId, providerId, await compressImage(f));
        count++;
      }
    } catch (x) { setErr(x.message || "No se pudo subir la foto."); }
    finally { setBusy(false); }
  };
  const remove = (id) => deletePhoto(id).catch(() => setErr("No se pudo eliminar la foto."));
  return (
    <div className="fwp-col">
      <span className="fwp-label">Fotos del servicio ({photos.length}/{MAX_PHOTOS}) · el cliente las verá</span>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onPick} aria-label="Agregar fotos del servicio" />
      <div className="fwp-photos">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const p = photos[i];
          if (p) return (
            <div key={p.id} className="fwp-ph has">
              <img src={p.url} alt={`Foto del servicio ${i + 1}`} loading="lazy" />
              <span className="fwp-n">{i + 1}</span>
              <button className="fwp-del" aria-label={`Eliminar foto ${i + 1}`} onClick={() => remove(p.id)}><Trash2 size={15} /></button>
            </div>);
          if (i === photos.length) return (
            <button key="add" className="fwp-ph fwp-add" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <span>Subiendo…</span> : <><Camera size={22} /><span><Plus size={11} /> Agregar foto</span></>}
            </button>);
          return <div key={`e${i}`} className="fwp-ph"><Camera size={20} opacity={0.35} /></div>;
        })}
      </div>
      {err && <p className="fwp-err" role="alert">{err}</p>}
    </div>
  );
}

export default function ProviderPanel({ onExit, team = [], meId }) {
  const [tab, setTab] = useState("home");
  const [supportOpen, setSupportOpen] = useState(false);
  const me = meId ?? team[0]?.id ?? 1;
  // Agenda y disponibilidad viven en el almacén compartido: lo que se edita aquí es lo que ve el cliente.
  const meLive = team.find((t) => t.id === me) || team[0];
  const available = meLive?.available ?? true;
  const schedule = meLive?.schedule ?? defaultSchedule({ days: [0, 1, 2, 3, 4, 5], from: 8, to: 18 });
  const allRatings = useRatings();
  const ratingByReq = Object.fromEntries(allRatings.map((r) => [r.reqId, r]));
  const all = useRequests();
  const mine = all.filter((r) => r.providerId === me);
  const requests = mine.filter((r) => r.status === "pending");
  const active = mine.find((r) => r.status === "accepted") || null;
  const upcoming = mine.filter((r) => r.status === "pending" || r.status === "accepted");
  const step = active?.step ?? 0;
  // Mientras el servicio está "En camino" o "En proceso", el celular del prestador comparte su ubicación real con el cliente.
  const sharing = !!active && step >= 1 && step < 3;
  const geo = useGeolocation(sharing);
  const lastLoc = useRef(null);
  React.useEffect(() => {
    if (!sharing || !geo.pos) return;
    const l = lastLoc.current, p = geo.pos, age = l ? Date.now() - l.t : Infinity;
    if (l && l.id === active.id && (age < 5000 || (age < 30000 && distKm(l, p) < 0.01))) return;
    lastLoc.current = { id: active.id, t: Date.now(), lat: p.lat, lng: p.lng };
    setProviderLoc(active.id, { lat: p.lat, lng: p.lng, ts: Date.now() });
  }, [sharing, geo.pos?.lat, geo.pos?.lng, active?.id]); // eslint-disable-line
  const jobs = [...mine.filter((r) => r.status === "done").map((r) => ({ id: r.id, category: r.category, service: r.service, price: r.price, date: r.doneDate, rating: ratingByReq[r.id]?.avg ?? null, comment: ratingByReq[r.id]?.comment })), ...(me === team[0]?.id ? JOBS : [])];
  const [comms, setComms] = useState(null);
  const allMsgs = useAllMessages();
  const incoming = useIncomingCall(mine.map((r) => r.id), "provider");
  React.useEffect(() => { if (incoming && !comms) setComms({ type: "call", reqId: incoming }); }, [incoming]); // eslint-disable-line
  const [pRead, setPRead] = usePersistentState("pRead", {});
  const clientMsgs = allMsgs.filter((m) => m.from === "client" && mine.some((r) => r.id === m.reqId));
  const unreadFor = (id) => clientMsgs.filter((m) => m.reqId === id && m.ts > (pRead[id] || 0)).length;
  const unreadTotal = clientMsgs.filter((m) => m.ts > (pRead[m.reqId] || 0)).length;
  const openChat = (reqId) => { setPRead((p) => ({ ...p, [reqId]: Date.now() })); setComms({ type: "chat", reqId }); };
  const lastClient = clientMsgs[clientMsgs.length - 1];
  const toasted = React.useRef(lastClient?.id);
  const [toast, setToast] = useState(null);
  React.useEffect(() => {
    if (!lastClient || lastClient.id === toasted.current) return;
    toasted.current = lastClient.id;
    if (comms?.type === "chat" && comms.reqId === lastClient.reqId) { setPRead((p) => ({ ...p, [lastClient.reqId]: Date.now() })); return; }
    setToast(lastClient);
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [lastClient?.id]); // eslint-disable-line
  const chatReqs = mine.filter((r) => r.status === "pending" || r.status === "accepted" || allMsgs.some((m) => m.reqId === r.id));
  const openCall = (reqId) => { startCall(reqId, "provider"); setComms({ type: "call", reqId }); };
  const [wd, setWd] = usePersistentState("withdrawals", {});
  const withdrawals = wd[me] || [];
  const balance = Math.round(((me === team[0]?.id ? BASE_BALANCE : 0) + jobs.filter((j) => !JOBS.includes(j)).reduce((s, j) => s + net(j.price), 0) - withdrawals.reduce((s, w) => s + w.amount, 0)) * 100) / 100;
  const [filter, setFilter] = useState("Todos");
  const [profile, setProfile] = useState(() => ({ nombre: meLive?.name || "", telefono: meLive?.phone || "", zona: meLive?.zone || "", clabe: "", services: (meLive?.services || []).map((s) => s[0].toUpperCase() + s.slice(1)) }));
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState(null);

  const today = jobs.filter((j) => j.date === todayIso());
  const todayEarn = today.reduce((s, j) => s + net(j.price), 0);
  const avg = meLive?.rating ?? 0;

  const accept = (r) => updateRequest(r.id, { status: "accepted", step: 0 });
  const decline = (r) => updateRequest(r.id, { status: "declined" });
  const advance = () => (step < 3 ? updateRequest(active.id, { step: step + 1 }) : updateRequest(active.id, { status: "done", step: 3, doneDate: todayIso() }));
  const setDay = (i, patch) => setProviderCfg(me, { schedule: schedule.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const toggleService = (s) => setProfile((p) => ({ ...p, services: p.services.includes(s) ? p.services.filter((x) => x !== s) : [...p.services, s] }));

  const withdraw = () => {
    const n = Math.round(parseFloat(amount) * 100) / 100;
    if (!Number.isFinite(n) || n < MIN_WITHDRAW) return setMsg({ err: `El retiro mínimo es ${money(MIN_WITHDRAW)}.` });
    if (n > balance) return setMsg({ err: "El monto supera tu saldo disponible." });
    if (!/^\d{18}$/.test(profile.clabe)) return setMsg({ err: "Captura una CLABE de 18 dígitos en tu perfil." });
    setWd((m) => ({ ...m, [me]: [{ id: Date.now(), amount: n, clabe: profile.clabe.slice(-4), status: "En proceso" }, ...(m[me] || [])] }));
    setAmount(""); setMsg({ ok: "Solicitud enviada. Se depositará en 1 a 2 días hábiles." });
  };

  const Head = ({ title }) => (
    <div className="fw-topbar">
      <div className="fw-topbar-left"><span className="fw-icon-btn fw-icon-btn--ghost" /><h1>{title}</h1></div>
      <div className="fw-topbar-right"><button className="fw-icon-btn" onClick={onExit} aria-label="Salir"><X size={18} /></button></div>
    </div>
  );
  const Switch = ({ on, onClick, label }) => (
    <button role="switch" aria-checked={on} aria-label={label} className={`fw-switch ${on ? "is-on" : ""}`} onClick={onClick}><span /></button>
  );

  const home = (
    <>
      <Head title="Panel del prestador" />
      <div className="fw-provider-status">
        <div><strong>{available ? "Disponible" : "No disponible"}</strong><span>{available ? "Puedes recibir nuevas solicitudes" : "No recibirás solicitudes nuevas"}</span></div>
        <Switch on={available} onClick={() => setProviderCfg(me, { available: !available })} label="Disponibilidad" />
      </div>
      <div className="fw-provider-stats">
        <div><strong>{money(todayEarn)}</strong><span>Ganancias hoy</span></div>
        <div><strong>{today.length}</strong><span>Servicios hoy</span></div>
        <div><strong>{avg.toFixed(1)} ★</strong><span>Calificación ({meLive?.reviews ?? 0})</span></div>
      </div>
      {active ? (
        <section className="fw-section"><h3>Servicio activo</h3>
          <div className="fw-provider-request is-active">
            <div className="fw-provider-request-head"><div className="fw-provider-request-icon">{React.createElement(ICONS[active.category], { size: 22 })}</div><div><strong>{active.service}</strong><span>{active.detail}</span></div><b>{money(net(active.price))}</b></div>
            <div className="fw-provider-meta"><span><MapPin size={14} /> {active.zone}</span><span>{active.when}</span></div>
            <ProviderMap clientLoc={active.clientLoc} street={active.address?.street} />
            <div className="fw-provider-progress">{STEPS.map((s, i) => <span key={s} className={i <= step ? "is-done" : ""}>{s}</span>)}</div>
            {sharing && <p className="fw-muted" role="status">{geo.status === "ok" ? "Compartiendo tu ubicación con el cliente." : geo.status === "loading" ? "Obteniendo tu ubicación…" : "No se está compartiendo tu ubicación: activa el permiso de ubicación del navegador (requiere HTTPS)."}</p>}
            <PhotoSlots reqId={active.id} providerId={me} />
            <div className="fwp-acts">
              <button className="fw-btn-outline" onClick={() => openChat(active.id)}><MessageCircle size={16} /> Mensaje</button>
              <button className="fw-btn-outline" onClick={() => openCall(active.id)}><Phone size={16} /> Llamar</button>
            </div>
            <button className="fw-btn-primary fw-btn-block" onClick={advance}>{step < 3 ? `Cambiar a: ${STEPS[step + 1]}` : "Cerrar servicio"}</button>
          </div>
        </section>
      ) : (
        <section className="fw-section"><h3>Solicitudes cercanas</h3>
          {!available ? <div className="fw-empty"><Clock size={28} /><p>Activa tu disponibilidad para recibir solicitudes.</p></div>
            : requests.length === 0 ? <div className="fw-empty"><CheckCircle2 size={28} /><p>No hay solicitudes pendientes.</p></div>
            : <div className="fw-provider-list">{requests.map((r) => (
              <div className="fw-provider-request" key={r.id}>
                <div className="fw-provider-request-head"><div className="fw-provider-request-icon">{React.createElement(ICONS[r.category], { size: 22 })}</div><div><small>{r.category}</small><strong>{r.service}</strong><span>{r.detail}</span></div><b>{money(net(r.price))}</b></div>
                <div className="fw-provider-meta"><span><MapPin size={14} /> {r.zone}</span><span>{r.when} · ganas el {100 - COMMISSION * 100}%</span></div>
                <div className="fw-provider-actions"><button className="fw-btn-outline" onClick={() => decline(r)}>Omitir</button><button className="fw-btn-primary" onClick={() => accept(r)}>Aceptar</button></div>
              </div>))}</div>}
        </section>
      )}
    </>
  );

  const agenda = (
    <>
      <Head title="Agenda" />
      <section className="fw-section"><h3>Próximos servicios</h3>
        <div className="fw-card">{upcoming.length === 0 ? <span>Sin servicios programados.</span> : upcoming.map((u) => <div className="fw-order-line" key={u.id}><span><strong>{u.service}</strong><br /><small>{u.when} · {u.zone} · {u.status === "pending" ? "Por confirmar" : "Confirmado"}</small></span></div>)}</div>
      </section>
      <section className="fw-section"><h3>Horario semanal</h3>
        <p className="fw-muted" style={{ margin: "0 0 8px" }}>Los clientes solo pueden reservar dentro de este horario, en horas que no tengas ocupadas{available ? "." : ". Ahora tienes la disponibilidad apagada en Inicio: no recibirás reservas nuevas."}</p>
        <div className="fw-card">{schedule.map((s, i) => (
          <div className={`fwp-day ${s.on ? "" : "is-off"}`} key={s.d}>
            <strong>{s.d}</strong>
            <Switch on={s.on} onClick={() => setDay(i, { on: !s.on })} label={`Trabajo el ${s.d}`} />
            <div className="fwp-times">
              <select aria-label="Desde" value={s.from} onChange={(e) => setDay(i, { from: e.target.value, to: e.target.value >= s.to ? HOURS[Math.min(HOURS.indexOf(e.target.value) + 1, HOURS.length - 1)] : s.to })}>{HOURS.slice(0, -1).map((h) => <option key={h}>{h}</option>)}</select>a
              <select aria-label="Hasta" value={s.to} onChange={(e) => setDay(i, { to: e.target.value })}>{HOURS.filter((h) => h > s.from).map((h) => <option key={h}>{h}</option>)}</select>
            </div>
          </div>))}</div>
      </section>
    </>
  );

  const shown = jobs.filter((j) => filter === "Todos" || j.category === filter);
  const historyView = (
    <>
      <Head title="Historial" />
      <div className="fwp-chips">{["Todos", "Autos", "Hogar", "Muebles"].map((c) => <button key={c} className={`fwp-chip ${filter === c ? "is-on" : ""}`} onClick={() => setFilter(c)}>{c}</button>)}</div>
      {shown.length === 0 ? <div className="fw-empty"><Clock size={28} /><p>Sin servicios en esta categoría.</p></div> : (
        <div className="fw-provider-list">{shown.map((j) => (
          <div className="fw-card" key={j.id}>
            <div className="fw-order-line"><span><strong>{j.service}</strong><br /><small>#{j.id} · {j.date}</small></span><strong>+{money(net(j.price))}</strong></div>
            {j.rating == null ? <small className="fw-muted">Aún sin calificar</small> : <><div className="fw-stars-mini">{"★".repeat(Math.round(j.rating))}</div>{j.comment && <small className="fw-muted">“{j.comment}”</small>}</>}
          </div>))}</div>)}
    </>
  );

  const earnings = (
    <>
      <Head title="Ganancias y retiros" />
      <div className="fw-wallet-card"><span>Saldo disponible</span><strong>{money(balance)}</strong><p>{jobs.length} servicios completados · comisión {COMMISSION * 100}%</p></div>
      <section className="fw-section"><h3>Retirar a cuenta bancaria</h3>
        <div className="fwp-col">
          <input className="fw-input" inputMode="decimal" placeholder={`Monto (mín. ${money(MIN_WITHDRAW)})`} value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setMsg(null); }} />
          <span className="fwp-label">{profile.clabe.length === 18 ? `CLABE terminación ${profile.clabe.slice(-4)}` : "Falta capturar tu CLABE en Perfil"}</span>
          <button className="fw-btn-primary fw-btn-block" onClick={withdraw}><Landmark size={16} /> Solicitar retiro</button>
          {msg?.err && <p className="fwp-err" role="alert">{msg.err}</p>}
          {msg?.ok && <p className="fwp-ok" role="status">{msg.ok}</p>}
        </div>
      </section>
      <section className="fw-section"><h3>Movimientos</h3>
        <div className="fw-card">
          {withdrawals.map((w) => <div className="fw-order-line" key={w.id}><span>Retiro · CLABE ···{w.clabe} ({w.status})</span><strong>-{money(w.amount)}</strong></div>)}
          {jobs.slice(0, 5).map((j) => <div className="fw-order-line" key={j.id}><span>{j.service}</span><strong>+{money(net(j.price))}</strong></div>)}
        </div>
      </section>
    </>
  );

  const perfil = (
    <>
      <Head title="Mi perfil" />
      <div className="fw-card fwp-col">
        {[["nombre", "Nombre completo"], ["telefono", "Teléfono"], ["zona", "Zona de trabajo"]].map(([k, l]) => (
          <label key={k} className="fwp-col"><span className="fwp-label">{l}</span>
            <input className="fw-input" disabled={!editing} value={profile[k]} onChange={(e) => setProfile({ ...profile, [k]: e.target.value })} /></label>))}
        <label className="fwp-col"><span className="fwp-label">CLABE interbancaria (18 dígitos)</span>
          <input className="fw-input" disabled={!editing} inputMode="numeric" maxLength={18} value={profile.clabe} onChange={(e) => setProfile({ ...profile, clabe: e.target.value.replace(/\D/g, "") })} /></label>
        <span className="fwp-label">Servicios que ofreces</span>
        <div className="fwp-chips">{Object.keys(ICONS).map((s) => <button key={s} disabled={!editing} className={`fwp-chip ${profile.services.includes(s) ? "is-on" : ""}`} onClick={() => toggleService(s)}>{s}</button>)}</div>
        <button className={editing ? "fw-btn-primary fw-btn-block" : "fw-btn-outline fw-btn-block"} onClick={() => setEditing(!editing)}>{editing ? "Guardar cambios" : "Editar perfil"}</button>
      </div>
      {meLive && <div className="fw-card fwp-col"><span className="fwp-label">Mis insignias</span><BadgeRow badges={providerBadges(meLive, allRatings)} /></div>}
      <button className="fw-btn-outline fw-btn-block" onClick={() => setSupportOpen(true)}><Headphones size={16} style={{ verticalAlign: "-3px" }} /> Asistencia y ayuda</button>
      <button className="fw-btn-outline fw-btn-block" onClick={onExit}>Cerrar sesión</button>
    </>
  );

  const messages = (
    <>
      <Head title="Mensajes y llamadas" />
      {chatReqs.length === 0 ? <div className="fw-empty"><MessageCircle size={28} /><p>Cuando tengas solicitudes podrás escribir o llamar a tus clientes aquí.</p></div> : (
        <div className="fw-provider-list">{chatReqs.map((r) => {
          const last = allMsgs.filter((m) => m.reqId === r.id).slice(-1)[0];
          return (
            <div key={r.id} style={{ display: "flex", gap: 8 }}>
              <button className="fwp-conv" onClick={() => openChat(r.id)}>
                <div className="fw-avatar"><User size={18} /></div>
                <div><strong>Cliente · #{r.id}</strong><small>{last ? `${last.from === "provider" ? "Tú: " : ""}${last.text}` : `${r.service} · ${r.when}`}</small></div>
                {unreadFor(r.id) > 0 && <span className="fw-badge" style={{ position: "static" }}>{unreadFor(r.id)}</span>}
              </button>
              <button className="fwp-call" aria-label={`Llamar al cliente #${r.id}`} onClick={() => openCall(r.id)}><Phone size={16} /></button>
            </div>);
        })}</div>)}
    </>
  );

  const views = { messages, home, agenda, history: historyView, earnings, profile: perfil };
  const nav = [["home", "Inicio", HomeIcon], ["agenda", "Agenda", CalendarDays], ["messages", "Mensajes", MessageCircle], ["history", "Historial", History], ["earnings", "Ganancias", Wallet], ["profile", "Perfil", User]];
  return (
    <div className="fwp-root">
      <style>{CSS}</style>
      {toast && (
        <button className="fw-toast" role="status" onClick={() => { setToast(null); openChat(toast.reqId); }}>
          <MessageCircle size={16} /><span><strong>Mensaje de Cliente #{toast.reqId}</strong><br />{toast.text.length > 70 ? toast.text.slice(0, 70) + "…" : toast.text}</span>
        </button>
      )}
      <div className="fw-screen fwp-scroll">{views[tab]}</div>
      <div className="fw-bottomnav">{nav.map(([id, label, Icon]) => (
        <button key={id} className={`fw-navitem ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}><Icon size={20} strokeWidth={tab === id ? 2.4 : 1.8} />{id === "messages" && unreadTotal > 0 && <span className="fw-badge" style={{ top: 0, right: "50%", marginRight: -22 }}>{unreadTotal}</span>}<span>{label}</span></button>))}
      </div>
      {comms?.type === "chat" && <ChatView reqId={comms.reqId} me="provider" title={`Cliente #${comms.reqId}`} subtitle={mine.find((r) => r.id === comms.reqId)?.zone} onClose={() => setComms(null)} />}
      {supportOpen && <SupportChat role="provider" threadId={`provider-${me}`} name={meLive?.name || ""} onClose={() => setSupportOpen(false)} />}
      {comms?.type === "call" && <CallView reqId={comms.reqId} me="provider" name={`Cliente #${comms.reqId}`} onClose={() => setComms(null)} />}
    </div>
  );
}
