// Adaptador mínimo de Supabase usando solo fetch (sin @supabase/supabase-js, así no hay dependencias nuevas).
// Se activa si existen VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (archivo .env, ver .env.example);
// si no, store.js usa el servidor local (server.js) o localStorage.
//
// Modelo: una sola tabla genérica `fw_docs (col, id, data jsonb)` que guarda los mismos documentos
// que store.js ya maneja (requests, messages, providers…). Las fotos van al bucket público `fw-photos`.
// El esquema está en supabase/setup.sql.
const PAGE = 1000; // tamaño de página (límite por defecto de PostgREST en Supabase)

export function createSupabase(rawUrl, key) {
  // Acepta la URL con o sin "/rest/v1" o barra final: solo importa el origen (https://xxxx.supabase.co).
  let url = String(rawUrl || "").trim().replace(/\/+$/, "");
  try { url = new URL(url).origin; } catch { /* se deja tal cual */ }
  if (!url || !key) return null;
  // Llaves anteriores (JWT "eyJ…") van también como Bearer; las nuevas "sb_publishable_…" solo en apikey.
  const auth = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };

  const call = async (path, { method = "GET", body, headers = {}, raw = false } = {}) => {
    const r = await fetch(`${url}${path}`, {
      method,
      headers: { ...auth, ...(body && !raw ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    if (!r.ok) {
      let detail = "";
      try { const j = await r.clone().json(); detail = j.code ? ` [${j.code}] ${j.message || ""}` : ` ${j.message || j.error || ""}`; } catch { /* sin cuerpo */ }
      throw new Error(`Supabase ${method} ${path.split("?")[0]} → HTTP ${r.status}${detail}`);
    }
    const type = r.headers.get("content-type") || "";
    return type.includes("json") ? r.json() : null;
  };

  return {
    // Estado completo: { requests: [...], messages: [...], … } en orden de creación.
    async fetchState() {
      const state = {};
      for (let offset = 0; ; offset += PAGE) {
        const rows = await call(`/rest/v1/fw_docs?select=col,data&order=created_at.asc,id.asc&limit=${PAGE}&offset=${offset}`);
        rows.forEach((r) => (state[r.col] ||= []).push(r.data));
        if (rows.length < PAGE) return state;
      }
    },
    // Aplica solo lo que cambió: { upserts: [doc], deletes: [id] }. `key` es el campo id de la colección.
    async write(name, key, { upserts = [], deletes = [] }) {
      if (upserts.length) {
        await call("/rest/v1/fw_docs?on_conflict=col,id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: upserts.map((d) => ({ col: name, id: String(d[key]), data: d })),
        });
      }
      if (deletes.length) {
        const q = new URLSearchParams({ col: `eq.${name}`, id: `in.(${deletes.map((i) => `"${String(i).replace(/"/g, "")}"`).join(",")})` });
        await call(`/rest/v1/fw_docs?${q}`, { method: "DELETE" });
      }
    },
    // Sube la foto (data URL) al bucket público y devuelve { id, file, url }.
    async uploadPhoto(dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = { "image/png": "png", "image/webp": "webp" }[blob.type] || "jpg";
      const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const file = `${id}.${ext}`;
      await call(`/storage/v1/object/fw-photos/${file}`, { method: "POST", body: blob, raw: true, headers: { "Content-Type": blob.type || "image/jpeg" } });
      return { id, file, url: `${url}/storage/v1/object/public/fw-photos/${file}` };
    },
    removeFile: (file) => call("/storage/v1/object/fw-photos", { method: "DELETE", body: { prefixes: [file] } }),
    // Borra solicitudes, mensajes, fotos… pero conserva los prestadores registrados.
    async reset() {
      await call("/rest/v1/fw_docs?col=neq.providers", { method: "DELETE" });
      const files = await call("/storage/v1/object/list/fw-photos", { method: "POST", body: { prefix: "", limit: 1000 } }).catch(() => []);
      if (files?.length) await call("/storage/v1/object/fw-photos", { method: "DELETE", body: { prefixes: files.map((f) => f.name) } }).catch(() => {});
    },
  };
}

const env = import.meta.env || {};
export const sb = createSupabase(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
