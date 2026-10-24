// Servidor de demostración de FlexiWash (sin dependencias, solo Node 18+).
//  - Sirve la app compilada (carpeta dist/)
//  - API de colecciones compartidas entre dispositivos (cliente <-> prestador)
//  - Sincronización en tiempo real con Server-Sent Events
//  - Subida de fotos del servicio (carpeta data/uploads/)
// Uso:  npm run demo   ->  abre http://IP-DE-ESTA-PC:3001 en los dos celulares.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dir, "data");
const UPLOADS = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const DIST = path.join(__dir, "dist");
const MAX_BODY = 8 * 1024 * 1024; // 8 MB por petición
const MAX_PHOTOS_PER_REQ = 4;

// Campo que identifica a cada elemento en cada colección.
const KEYS = { requests: "id", messages: "id", calls: "reqId", providerCfg: "id", ratings: "reqId", photos: "id", providers: "id", support: "id" };
// Máximo de elementos por colección (evita que crezca sin límite).
const LIMITS = { requests: 200, messages: 600, calls: 100, providerCfg: 50, ratings: 500, photos: 400, providers: 100, support: 500 };

fs.mkdirSync(UPLOADS, { recursive: true });

const emptyDb = () => Object.fromEntries(Object.keys(KEYS).map((k) => [k, []]));
let db = emptyDb();
try { db = { ...emptyDb(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) }; } catch { /* base nueva */ }

let saveTimer = null;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + ".tmp";
    try { fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); } catch (e) { console.error("No se pudo guardar:", e.message); }
  }, 150);
};

// ---- Tiempo real (SSE) ----
const clients = new Set();
const broadcast = (col) => {
  const msg = `event: col\ndata: ${JSON.stringify({ name: col, list: db[col] })}\n\n`;
  for (const res of clients) res.write(msg);
};
setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 20000).unref();

// ---- Utilidades HTTP ----
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".map": "application/json",
};
const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error("Archivo demasiado grande"), { code: 413 })); req.destroy(); } else chunks.push(c); });
  req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(Object.assign(new Error("JSON inválido"), { code: 400 })); } });
  req.on("error", reject);
});

// Aplica cambios por elemento (upserts/deletes), no reemplaza la lista completa:
// así dos dispositivos escribiendo a la vez no se pisan entre sí.
function applyDiff(col, { upserts = [], deletes = [] }) {
  const key = KEYS[col];
  let list = db[col];
  if (deletes.length) { const del = new Set(deletes.map(String)); list = list.filter((x) => !del.has(String(x[key]))); }
  for (const item of upserts) {
    if (!item || item[key] == null) continue;
    const i = list.findIndex((x) => String(x[key]) === String(item[key]));
    if (i >= 0) list[i] = item; else list.push(item);
  }
  if (list.length > LIMITS[col]) {
    const drop = list.splice(0, list.length - LIMITS[col]);
    if (col === "photos") drop.forEach((p) => removeFile(p.file));
  }
  db[col] = list;
}
const removeFile = (name) => { if (name && /^[\w.-]+$/.test(name)) fs.unlink(path.join(UPLOADS, name), () => {}); };

const IMG_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const EXT = { jpeg: "jpg", png: "png", webp: "webp" };

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
  if (req.method === "GET" && parts[1] === "state") return send(res, 200, db);
  if (req.method === "GET" && parts[1] === "events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write(`retry: 1500\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (req.method === "POST" && parts[1] === "col" && KEYS[parts[2]]) {
    const body = await readBody(req);
    applyDiff(parts[2], body);
    persist(); broadcast(parts[2]);
    return send(res, 200, { ok: true });
  }
  // Subir una foto del servicio: { reqId, providerId, dataUrl }
  if (req.method === "POST" && parts[1] === "photos") {
    const { reqId, providerId, dataUrl } = await readBody(req);
    const m = IMG_RE.exec(String(dataUrl || ""));
    if (!m || reqId == null) return send(res, 400, { error: "Imagen inválida" });
    if (db.photos.filter((p) => String(p.reqId) === String(reqId)).length >= MAX_PHOTOS_PER_REQ) return send(res, 409, { error: `Máximo ${MAX_PHOTOS_PER_REQ} fotos por servicio` });
    const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const file = `${id}.${EXT[m[1]]}`;
    fs.writeFileSync(path.join(UPLOADS, file), Buffer.from(m[2], "base64"));
    const photo = { id, reqId, providerId, file, url: `/uploads/${file}`, ts: Date.now() };
    db.photos.push(photo);
    persist(); broadcast("photos");
    return send(res, 200, photo);
  }
  if (req.method === "DELETE" && parts[1] === "photos" && parts[2]) {
    const p = db.photos.find((x) => String(x.id) === parts[2]);
    if (p) { removeFile(p.file); db.photos = db.photos.filter((x) => x !== p); persist(); broadcast("photos"); }
    return send(res, 200, { ok: true });
  }
  // Reinicia la demostración: borra solicitudes, mensajes, fotos, etc. (conserva prestadores registrados)
  if (req.method === "POST" && parts[1] === "reset") {
    db.photos.forEach((p) => removeFile(p.file));
    const keepProviders = db.providers; // los prestadores registrados no se borran al reiniciar la demo
    db = emptyDb(); db.providers = keepProviders; persist();
    Object.keys(KEYS).forEach(broadcast);
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: "No encontrado" });
}

function serveStatic(req, res, url) {
  const isUpload = url.pathname.startsWith("/uploads/");
  const root = isUpload ? UPLOADS : DIST;
  const rel = decodeURIComponent(isUpload ? url.pathname.slice("/uploads/".length) : url.pathname);
  let file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) return send(res, 403, "Prohibido", "text/plain");
  if (!isUpload && (!fs.existsSync(file) || fs.statSync(file).isDirectory())) file = path.join(DIST, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, isUpload ? "No encontrado" : "Primero ejecuta: npm run build", "text/plain");
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": isUpload ? "public, max-age=86400" : "no-cache" });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res, url);
    send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    if (!res.headersSent) send(res, e.code === 413 || e.code === 400 ? e.code : 500, { error: e.message });
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`\nFlexiWash listo en el puerto ${PORT}`);
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`  En esta PC:        http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`  En los celulares:  http://${ip}:${PORT}   (misma red Wi-Fi)`));
  console.log("  Reiniciar demo:    npm run reset\n");
});
