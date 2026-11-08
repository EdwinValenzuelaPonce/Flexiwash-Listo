import React, { useEffect, useRef, useState } from "react";
import { X, Send, Headphones } from "lucide-react";
import { sendMessage, sendSupport, useSupport } from "./store.js";

// Chat de asistencia de FlexiWash (24/7): un asistente con IA (POST /api/assistant) responde al instante; si la IA falla
// se usan las respuestas frecuentes de abajo. Para asuntos que solo el prestador puede aclarar (p. ej. objetos perdidos)
// la IA avisa al prestador con un mensaje en el chat de ese servicio (colección `messages`) y él contacta al cliente. Si la persona lo pide,
// el hilo se marca como "escalado" para que lo atienda un agente. Los mensajes viven en la colección `support`
// (store.js); un panel de administrador (pendiente) leería los hilos con escalated:true y respondería con from:"agent".
const FAQ = {
  client: [
    ["Pagos", /pago|pagar|tarjeta|efectivo|paypal|monedero|cobr/i, "Puedes pagar en efectivo, con tarjeta, PayPal o con tu Monedero FlexiWash (3% de recompensa en servicios elegibles). Si ves un cobro que no reconoces, escribe «agente»."],
    ["Mi servicio", /servicio|estado|seguimiento|camino|llega|tard|prestador/i, "Mira el avance en Inicio → «Tu servicio» → Ver seguimiento. Desde ahí también puedes escribirle o llamar a tu prestador."],
    ["Calificar", /calific|estrella|comentario|insignia|reseña/i, "Al finalizar el servicio aparece «Calificar servicio». Tus respuestas y comentario se muestran en el perfil del prestador y le generan insignias."],
    ["Reportar un problema", /problema|queja|dañ|reclam|robo|mal|reporte/i, "Lamentamos eso. Cuéntanos qué pasó y pulsa «Hablar con un agente» para que revise tu caso."],
  ],
  provider: [
    ["Retiros", /retir|clabe|depósit|deposit|saldo|ganancia/i, "Puedes retirar desde la pestaña de ganancias a tu CLABE cuando llegues al mínimo de retiro. Revisa que tu CLABE tenga 18 dígitos."],
    ["Comisión y efectivo", /comisi|efectivo|adeudo|remit/i, "FlexiWash retiene 15% por servicio. En pagos en efectivo debes cubrir la comisión dentro del plazo de tu contrato; si hay adeudo se puede compensar con tus saldos."],
    ["Verificación", /verific|identidad|ine|curp|contrato|baja|suspend/i, "Tu identidad se valida con CURP, INE y selfie. Si tu cuenta fue rechazada o suspendida, pulsa «Hablar con un agente» para revisarla."],
    ["Insignias", /insignia|calific|estrella|reseña|top/i, "Las insignias se otorgan solas según tus calificaciones: puntualidad, amabilidad, calidad y número de servicios."],
  ],
};
const HUMAN = /agente|humano|persona|asesor|operador/i;
const CSS = `.fws{position:absolute;inset:0;z-index:85;display:flex;flex-direction:column;background:var(--fw-surface,#fff)}.fws-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--fw-line,#dfe8e6)}.fws-head strong{font-size:15px}.fws-head span{display:block;font-size:12px;color:var(--fw-ink-soft,#5b7570)}.fws-x{width:36px;height:36px;border-radius:50%;border:1px solid var(--fw-line,#dfe8e6);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}.fws-list{flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--fw-bg,#eff7f5)}.fws-b{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.4;background:#fff;align-self:flex-start;border:1px solid var(--fw-line,#dfe8e6)}.fws-b.me{align-self:flex-end;background:var(--fw-teal,#0e9c8e);color:#fff;border-color:transparent}.fws-b.agent{border-color:var(--fw-teal,#0e9c8e)}.fws-b small{display:block;opacity:.6;font-size:10px;margin-top:2px}.fws-quick{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px 0}.fws-quick button{border:1px solid var(--fw-line,#dfe8e6);background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:12px;cursor:pointer}.fws-quick .human{background:var(--fw-teal,#0e9c8e);color:#fff;border-color:transparent}.fws-form{display:flex;gap:8px;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 12px)}.fws-form input{flex:1;font:inherit;font-size:14px;padding:11px 14px;border:1px solid var(--fw-line,#dfe8e6);border-radius:999px;outline:none}.fws-send{width:42px;height:42px;border-radius:50%;border:none;background:var(--fw-teal,#0e9c8e);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}.fws-send:disabled{opacity:.4}`;

// threadId identifica la conversación (p. ej. "client-<dispositivo>" o "provider-<id>").
export default function SupportChat({ role = "client", threadId, name = "", orders = [], onClose }) {
  const all = useSupport();
  const list = all.filter((m) => m.threadId === threadId);
  const escalated = list.some((m) => m.escalated);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const faq = FAQ[role] || FAQ.client;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list.length, busy]);

  const say = (from, t, extra) => sendSupport({ threadId, role, name, from, text: t, ...extra });
  const escalate = () => say("bot", "Listo, avisé a un agente. Te responderá en este mismo chat en cuanto esté disponible. Mientras tanto, el asistente sigue disponible las 24 horas y puedes contarnos tu caso con el mayor detalle posible.", { escalated: true });
  // Pide la respuesta a la IA con los últimos mensajes del hilo; si falla, responde con las preguntas frecuentes.
  const reply = async (v) => {
    const history = [...list, { from: "user", text: v }].slice(-12).map((m) => ({ from: m.from, text: m.text }));
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, name, history, orders }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { reply: t, escalate: esc, notify } = await r.json();
      if (!t) throw new Error("vacío");
      // Aviso al prestador: llega a su pestaña «Mensajes» (con contador y alerta) y puede responder por chat o llamar al cliente.
      if (notify && orders.some((o) => o.reqId === notify.reqId)) sendMessage(notify.reqId, "client", `${name ? `${name.split(" ")[0]} reporta` : "El cliente reporta"}: ${notify.summary} Por favor contáctalo por este chat o por llamada.`, { via: "assistant" });
      say("bot", t, esc ? { escalated: true } : undefined);
    } catch {
      const hit = faq.find(([, re]) => re.test(v));
      say("bot", hit ? hit[2] : "No estoy seguro de haberte entendido. Elige un tema de abajo o pulsa «Hablar con un agente».");
    } finally { setBusy(false); }
  };
  const send = (t = text) => {
    const v = t.trim(); if (!v || busy) return;
    setText(""); say("user", v);
    if (!escalated && HUMAN.test(v)) return escalate();       // aunque el hilo esté escalado, el asistente sigue respondiendo (24/7)
    reply(v);
  };

  return (
    <div className="fws" role="dialog" aria-label="Chat de asistencia">
      <style>{CSS}</style>
      <div className="fws-head"><div><strong>Asistencia FlexiWash</strong><span>{escalated ? "Un agente revisará tu caso · el asistente sigue disponible" : "Asistente con IA · disponible 24/7"}</span></div><button className="fws-x" aria-label="Cerrar asistencia" onClick={onClose}><X size={18} /></button></div>
      <div className="fws-list" aria-live="polite">
        <div className="fws-b">Hola{name ? `, ${name.split(" ")[0]}` : ""}. Soy el asistente de FlexiWash. ¿En qué te ayudo?</div>
        {list.map((m) => <div key={m.id} className={`fws-b ${m.from === "user" ? "me" : m.from === "agent" ? "agent" : ""}`}>{m.from === "agent" && <strong style={{ fontSize: 11 }}>Agente FlexiWash<br /></strong>}{m.text}<small>{new Date(m.ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</small></div>)}
        {busy && <div className="fws-b" aria-label="Escribiendo">Escribiendo…</div>}
        <div ref={end} />
      </div>
      <div className="fws-quick">
        {faq.map(([label]) => <button key={label} disabled={busy} onClick={() => send(label)}>{label}</button>)}
        {!escalated && <button className="human" onClick={() => { say("user", "Quiero hablar con un agente"); escalate(); }}><Headphones size={12} style={{ verticalAlign: "-2px" }} /> Hablar con un agente</button>}
      </div>
      <form className="fws-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu duda…" aria-label="Mensaje para asistencia" />
        <button className="fws-send" type="submit" disabled={!text.trim() || busy} aria-label="Enviar"><Send size={18} /></button>
      </form>
    </div>
  );
}
