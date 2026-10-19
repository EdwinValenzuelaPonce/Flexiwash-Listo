import React, { useEffect, useRef, useState } from "react";
import { X, Phone, PhoneOff, Send, Mic, MicOff } from "lucide-react";
import { sendMessage, useAllMessages, useCalls, startCall, updateCall } from "./store.js";

const RING_MS = 30000;
const CSS = `
.fwc{position:absolute;inset:0;z-index:80;display:flex;flex-direction:column;background:var(--fw-surface,#fff)}
.fwc-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--fw-line,#dfe8e6)}
.fwc-head strong{font-size:15px}.fwc-head span{display:block;font-size:12px;color:var(--fw-ink-soft,#5b7570)}
.fwc-x{width:36px;height:36px;border-radius:50%;border:1px solid var(--fw-line,#dfe8e6);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.fwc-list{flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--fw-bg,#eff7f5)}
.fwc-b{max-width:80%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.35;background:#fff;align-self:flex-start;border:1px solid var(--fw-line,#dfe8e6)}
.fwc-b.me{align-self:flex-end;background:var(--fw-teal,#0e9c8e);color:#fff;border-color:transparent}.fwc-b small{display:block;opacity:.6;font-size:10px;margin-top:2px}
.fwc-quick{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px 0}.fwc-quick button{border:1px solid var(--fw-line,#dfe8e6);background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:12px;cursor:pointer}
.fwc-form{display:flex;gap:8px;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 12px)}
.fwc-form input{flex:1;font:inherit;font-size:14px;padding:11px 14px;border:1px solid var(--fw-line,#dfe8e6);border-radius:999px;outline:none}
.fwc-send{width:42px;height:42px;border-radius:50%;border:none;background:var(--fw-teal,#0e9c8e);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}.fwc-send:disabled{opacity:.4}
.fwc-call{align-items:center;justify-content:center;gap:10px;text-align:center;background:linear-gradient(160deg,#0b7f74,#0f2a2e);color:#fff}
.fwc-call h2{margin:0;font-size:22px}.fwc-call p{margin:0;opacity:.8;font-size:14px}
.fwc-avatar{width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;margin-bottom:6px}
.fwc-btns{display:flex;gap:28px;margin-top:30px}.fwc-round{width:62px;height:62px;border-radius:50%;border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.fwc-round.red{background:#d64545}.fwc-round.green{background:#22a55a}.fwc-round.gray{background:rgba(255,255,255,.22)}
.fwc-lbl{font-size:11px;opacity:.8;margin-top:6px;display:block}
`;

export function ChatView({ reqId, me, title, subtitle, onClose }) {
  const all = useAllMessages();
  const list = all.filter((m) => m.reqId === reqId);
  const [text, setText] = useState("");
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list.length]);
  const send = (t = text) => { if (!t.trim()) return; sendMessage(reqId, me, t); setText(""); };
  const quick = me === "provider" ? ["Voy en camino", "Ya llegué", "¿Me abre, por favor?"] : ["Estoy en la puerta", "¿A qué hora llega?", "Gracias"];
  return (
    <div className="fwc" role="dialog" aria-label={`Chat con ${title}`}>
      <style>{CSS}</style>
      <div className="fwc-head"><div><strong>{title}</strong><span>{subtitle}</span></div><button className="fwc-x" aria-label="Cerrar chat" onClick={onClose}><X size={18} /></button></div>
      <div className="fwc-list" aria-live="polite">
        {list.length === 0 && <p style={{ textAlign: "center", fontSize: 12, color: "#5b7570" }}>Aún no hay mensajes. Escribe el primero.</p>}
        {list.map((m) => <div key={m.id} className={`fwc-b ${m.from === me ? "me" : ""}`}>{m.text}<small>{new Date(m.ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</small></div>)}
        <div ref={end} />
      </div>
      <div className="fwc-quick">{quick.map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>
      <div className="fwc-form">
        <input aria-label="Mensaje" placeholder="Escribe un mensaje…" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="fwc-send" aria-label="Enviar" disabled={!text.trim()} onClick={() => send()}><Send size={18} /></button>
      </div>
    </div>
  );
}

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function CallView({ reqId, me, name, onClose }) {
  const call = useCalls().find((c) => c.reqId === reqId);
  const [, tick] = useState(0);
  const [muted, setMuted] = useState(false);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const missed = call?.status === "ringing" && Date.now() - call.ts > RING_MS;
  const over = !call || call.status === "ended" || missed;
  useEffect(() => { if (!over) return; const t = setTimeout(onClose, 1400); return () => clearTimeout(t); }, [over]); // eslint-disable-line
  const mine = call?.from === me;
  const hang = () => updateCall(reqId, { status: "ended" });
  const secs = call?.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
  const status = over ? (missed ? "Sin respuesta" : "Llamada finalizada") : call.status === "active" ? fmtTime(secs) : mine ? "Llamando…" : "Llamada entrante";
  return (
    <div className="fwc fwc-call" role="dialog" aria-label={`Llamada con ${name}`}>
      <style>{CSS}</style>
      <div className="fwc-avatar">{name?.[0] || "?"}</div>
      <h2>{name}</h2>
      <p aria-live="polite">{status}</p>
      {!over && (
        <div className="fwc-btns">
          {call.status === "active" && <div><button className="fwc-round gray" aria-pressed={muted} aria-label="Silenciar" onClick={() => setMuted(!muted)}>{muted ? <MicOff size={24} /> : <Mic size={24} />}</button><span className="fwc-lbl">{muted ? "Silenciado" : "Silenciar"}</span></div>}
          {call.status === "ringing" && !mine && <div><button className="fwc-round green" aria-label="Contestar" onClick={() => updateCall(reqId, { status: "active", startedAt: Date.now() })}><Phone size={26} /></button><span className="fwc-lbl">Contestar</span></div>}
          <div><button className="fwc-round red" aria-label={call.status === "ringing" && !mine ? "Rechazar" : "Colgar"} onClick={hang}><PhoneOff size={26} /></button><span className="fwc-lbl">{call.status === "ringing" && !mine ? "Rechazar" : "Colgar"}</span></div>
        </div>
      )}
    </div>
  );
}

// Devuelve el id de la solicitud con una llamada entrante (iniciada por la otra parte) en las últimas 30 s.
export function useIncomingCall(reqIds, me) {
  const calls = useCalls();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  return calls.find((c) => reqIds.includes(c.reqId) && c.from !== me && c.status === "ringing" && Date.now() - c.ts < RING_MS)?.reqId ?? null;
}
export { startCall };
