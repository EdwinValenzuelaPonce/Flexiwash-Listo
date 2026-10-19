import React, { useEffect, useRef } from "react";
import { setClientLoc } from "./store.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Phone, MessageCircle, LocateFixed } from "lucide-react";
import { useGeolocation, distKm, DEFAULT_CENTER, GEO_MESSAGES } from "./geo.js";

const AVG_KMH = 30;     // velocidad media para estimar la llegada
const ARRIVED_KM = 0.08; // a menos de 80 m se considera que ya llegó

const CSS = `
.fwm{display:flex;flex-direction:column;gap:10px}
.fwm-box{position:relative}
.fwm-map{height:240px;border-radius:16px;overflow:hidden;background:#E4EEE9;position:relative;z-index:0;isolation:isolate}
.fwm-map--compact{height:150px}
.fwm-open{position:absolute;inset:0;z-index:1;border:none;background:transparent;cursor:pointer;border-radius:16px}
.fwm-cap{position:absolute;left:10px;bottom:10px;z-index:2;background:rgba(255,255,255,.94);border-radius:8px;padding:4px 9px;font-size:11px;font-weight:700;color:var(--fw-ink,#0f2a2e);pointer-events:none;max-width:80%}
.fwm-pin-wrap{background:none;border:none}
.fwm-pin{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.fwm-pin--home{background:#E2542D}.fwm-pin--car{background:var(--fw-teal,#0E9C8E)}
.fwm-eta{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--fw-surface,#fff);border:1px solid var(--fw-line,#dfe8e6);border-radius:14px;padding:12px 14px}
.fwm-eta strong{font-size:15px;display:block}.fwm-eta span{font-size:12px;color:var(--fw-ink-soft,#5b7270)}
.fwm-geo{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--fw-ink-soft,#5b7270);background:var(--fw-bg,#EFF7F5);border-radius:12px;padding:10px 12px}
.fwm-geo button{display:flex;align-items:center;gap:5px;font:inherit;font-weight:800;font-size:12px;color:var(--fw-teal-dark,#0B7F74);background:none;border:none;cursor:pointer;flex-shrink:0}
.fwm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fwm-actions button{display:flex;align-items:center;justify-content:center;gap:6px;font:inherit;cursor:pointer;border:1px solid var(--fw-line,#dfe8e6);border-radius:12px;padding:11px;font-weight:700;font-size:13px;color:var(--fw-ink,#0f2a2e);background:var(--fw-surface,#fff)}
`;

const SVG = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const pin = (cls, inner) => L.divIcon({ className: "fwm-pin-wrap", html: `<div class="fwm-pin ${cls}">${SVG(inner)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const ICONS = {
  client: pin("fwm-pin--home", '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>'),
  provider: pin("fwm-pin--car", '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
};

// Mapa Leaflet + OpenStreetMap. `client` y `provider` son { lat, lng } o null.
function LiveMap({ client, provider, compact = false, height, label }) {
  const el = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const userMoved = useRef(false);

  useEffect(() => {
    const m = L.map(el.current, {
      zoomControl: !compact, attributionControl: false, scrollWheelZoom: false, boxZoom: false,
      dragging: !compact, touchZoom: !compact, doubleClickZoom: !compact, keyboard: !compact,
    }).setView(DEFAULT_CENTER, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
    L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>').addTo(m);
    m.on("dragstart", () => { userMoved.current = true; });
    map.current = m;
    const t = setTimeout(() => m.invalidateSize(), 0);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(el.current);
    return () => { clearTimeout(t); ro?.disconnect(); m.remove(); map.current = null; markers.current = {}; userMoved.current = false; };
  }, [compact]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const sync = (key, p) => {
      if (!p) { markers.current[key]?.remove(); delete markers.current[key]; return; }
      if (markers.current[key]) markers.current[key].setLatLng([p.lat, p.lng]);
      else markers.current[key] = L.marker([p.lat, p.lng], { icon: ICONS[key], interactive: false, keyboard: false }).addTo(m);
    };
    sync("client", client); sync("provider", provider);
    const pts = [client, provider].filter(Boolean).map((p) => [p.lat, p.lng]);
    if (userMoved.current || !pts.length) return;
    if (pts.length === 2) m.fitBounds(pts, { padding: [40, 40], maxZoom: 17, animate: false });
    else m.setView(pts[0], 16, { animate: false });
  }, [client?.lat, client?.lng, provider?.lat, provider?.lng, compact]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div ref={el} className={`fwm-map ${compact ? "fwm-map--compact" : ""}`} style={height ? { height } : undefined} role="img" aria-label={label || "Mapa"} />
    </>
  );
}

function GeoNote({ geo }) {
  if (geo.status === "ok" || geo.status === "idle") return null;
  const retry = geo.status === "denied" || geo.status === "unavailable";
  return (
    <div className="fwm-geo" role="status">
      <span>{GEO_MESSAGES[geo.status]}</span>
      {retry && <button onClick={geo.retry}><LocateFixed size={14} /> Reintentar</button>}
    </div>
  );
}

const statusText = ({ step, status, providerName, street, km, hasLoc }) => {
  if (status === "declined") return ["Solicitud rechazada", "No hay servicio en curso"];
  if (step >= 3) return ["Servicio finalizado", "Gracias por elegir FlexiWash"];
  if (step === 2) return ["Servicio en proceso", `${providerName} está en tu domicilio`];
  if (step === 1) {
    if (!hasLoc) return ["Tu prestador va en camino", "Esperando su ubicación en tiempo real…"];
    if (km <= ARRIVED_KM) return ["Tu prestador llegó", street];
    return [`Llega en ${Math.max(1, Math.round((km / AVG_KMH) * 60))} min`, `A ${km.toFixed(1)} km de ${street}`];
  }
  return status === "accepted" ? ["Confirmado", `${providerName} saldrá hacia tu domicilio`] : ["Esperando confirmación", `${providerName} aún no responde`];
};

export default function TrackingMap({ reqId = null, step = 0, status = "pending", providerName = "Tu prestador", street = "Tu dirección", providerLoc = null, onCall, onChat, compact = false, onOpen }) {
  const geo = useGeolocation(true);
  const client = geo.pos;
  // Publica la ubicación del cliente para que el prestador la vea en su mapa (máx. cada 5 s o al moverse >10 m).
  const lastPub = useRef(null);
  useEffect(() => {
    if (!reqId || !client || status !== "accepted" || step >= 3) return;
    const l = lastPub.current, age = l ? Date.now() - l.t : Infinity;
    if (l && l.id === reqId && (age < 5000 || (age < 60000 && distKm(l, client) < 0.01))) return;
    lastPub.current = { id: reqId, t: Date.now(), lat: client.lat, lng: client.lng };
    setClientLoc(reqId, { lat: client.lat, lng: client.lng, ts: Date.now() });
  }, [reqId, status, step, client?.lat, client?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const provider = status === "accepted" && step >= 1 && step < 3 ? providerLoc : null;
  const km = client && provider ? distKm(client, provider) : 0;
  const text = statusText({ step, status, providerName, street, km, hasLoc: !!(client && provider) });
  const showActions = status !== "declined" && step < 3 && status !== "pending";

  if (compact) {
    return (
      <div className="fwm-box">
        <style>{CSS}</style>
        <LiveMap client={client} provider={provider} compact label={`Mapa del servicio. ${text[0]}`} />
        <span className="fwm-cap">{text[0]}</span>
        {onOpen && <button className="fwm-open" onClick={onOpen} aria-label={`Ver seguimiento del servicio. ${text[0]}`} />}
      </div>
    );
  }
  return (
    <div className="fwm">
      <style>{CSS}</style>
      <LiveMap client={client} provider={provider} label={`Mapa del servicio. ${text[0]}. ${text[1]}`} />
      <GeoNote geo={geo} />
      <div className="fwm-eta" aria-live="polite"><div><strong>{text[0]}</strong><span>{text[1]}</span></div></div>
      {showActions && (
        <div className="fwm-actions">
          <button onClick={onCall}><Phone size={16} /> Llamar</button>
          <button onClick={onChat}><MessageCircle size={16} /> Mensaje</button>
        </div>
      )}
    </div>
  );
}

// Mapa con la ubicación actual del dispositivo (p. ej. en el perfil).
export function PlaceMap({ label }) {
  const geo = useGeolocation(true);
  return (
    <div className="fwm-box" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <style>{CSS}</style>
      <div className="fwm-box">
        <LiveMap client={geo.pos} provider={null} height={170} label="Mapa con tu ubicación" />
        {label?.trim() && <span className="fwm-cap">{label}</span>}
      </div>
      <GeoNote geo={geo} />
    </div>
  );
}

// Mapa del prestador: su posición (GPS propio) y la del cliente (publicada por el celular del cliente).
export function ProviderMap({ clientLoc = null, street = "Domicilio del cliente", active = true }) {
  const geo = useGeolocation(active);
  const me = geo.pos;
  const km = me && clientLoc ? distKm(me, clientLoc) : null;
  return (
    <div className="fwm">
      <style>{CSS}</style>
      <LiveMap client={clientLoc} provider={me} label="Mapa del servicio" />
      <GeoNote geo={geo} />
      <div className="fwm-eta" aria-live="polite"><div>
        <strong>{km == null ? "Esperando ubicación del cliente…" : km <= ARRIVED_KM ? "Ya llegaste" : `A ${km.toFixed(1)} km · ~${Math.max(1, Math.round((km / AVG_KMH) * 60))} min`}</strong>
        <span>{clientLoc ? street : "El cliente debe abrir la app y permitir su ubicación (HTTPS)."}</span>
      </div></div>
    </div>
  );
}
