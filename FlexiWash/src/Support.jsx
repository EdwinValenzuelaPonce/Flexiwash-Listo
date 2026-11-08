import React, { useEffect, useRef, useState } from "react";
import { X, Send, Clock } from "lucide-react";
import { sendMessage, sendSupport, useSupport, useAllMessages } from "./store.js";

// Chat de asistencia de FlexiWash (estilo «Ayuda» de Uber):
//  - TODO se responde al instante: los temas del menú tienen respuesta local (sin red) y el texto libre lo atiende la IA
//    (POST /api/assistant); si la IA falla se usan las respuestas frecuentes de abajo.
//  - Lo ÚNICO que espera es contactar al prestador: el mensaje llega a su chat del servicio (colección `messages`) y la
//    respuesta puede tardar. Mientras tanto la burbuja muestra «Esperando respuesta de…» y, cuando el prestador contesta,
//    su respuesta aparece aquí mismo (además del aviso de mensaje que ya genera App.jsx). El asistente sigue respondiendo.
//  - Ya no hay «agente humano» en espera: los casos graves (cobro no reconocido, robo, daño) se registran al instante con un
//    folio en la colección `support` (report:{folio,reason}) para que el equipo los revise después.
const FAQ = {
  client: [
    [/perd[ií]|objeto|olvid/i, "Solo tu prestador puede confirmar si encontró tu objeto. Pulsa «Contactar a mi prestador» y le envío tu aviso; su respuesta puede tardar y la verás aquí.", ["contact"]],
    [/no ha llegado|no lleg|atras|tard/i, "Revisa el avance en Inicio → «Tu servicio» → Ver seguimiento. Si quieres, le aviso a tu prestador.", ["contact"]],
    [/cancel|reprogram/i, "Cancelar o reprogramar se acuerda con tu prestador. Pulsa «Contactar a mi prestador» y le envío tu mensaje.", ["contact"]],
    [/problema|queja|dañ|reclam|robo|mal|reporte/i, "Lamento eso. Puedo registrar un reporte con folio al instante, o avisarle a tu prestador si prefieres aclararlo con él.", ["report", "contact"]],
    [/calific|estrella|comentario|insignia|reseña/i, "Al finalizar el servicio aparece «Calificar servicio». Tus respuestas y comentario se muestran en el perfil del prestador y le generan insignias."],
    [/pago|pagar|tarjeta|efectivo|paypal|monedero|cobr/i, "Puedes pagar en efectivo, con tarjeta, PayPal o con tu Monedero FlexiWash (3% de recompensa en servicios elegibles). Si ves un cobro que no reconoces, pulsa «Registrar un reporte».", ["report"]],
    [/servicio|estado|seguimiento|camino|llega|prestador/i, "Mira el avance en Inicio → «Tu servicio» → Ver seguimiento. Desde ahí también puedes escribirle o llamar a tu prestador."],
  ],
  provider: [
    [/injust/i, "Las calificaciones no se borran automáticamente. Registra un reporte con lo que pasó y queda con folio para su revisión.", ["report"]],
    [/problema|reportar|cliente/i, "Cuéntame qué pasó y lo registro al instante con un folio.", ["report"]],
    [/retir|clabe|depósit|deposit|saldo|ganancia/i, "Puedes retirar desde la pestaña de ganancias a tu CLABE cuando llegues al mínimo de retiro. Revisa que tu CLABE tenga 18 dígitos.", ["withdraw"]],
    [/comisi|efectivo|adeudo|remit/i, "FlexiWash retiene 15% por servicio. En pagos en efectivo, si hay adeudo se descuenta de tu saldo; si no alcanza, puedes recargar saldo en Ganancias → Recargar saldo.", ["topup"]],
    [/verific|identidad|ine|curp|contrato|baja|suspend/i, "Tu identidad se valida con CURP, INE y selfie. Si tu cuenta fue rechazada o suspendida, registra un reporte para que la revisen.", ["report"]],
    [/insignia|calific|estrella|reseña|top/i, "Las insignias se otorgan solas según tus calificaciones: puntualidad, amabilidad, calidad y número de servicios."],
  ],
};

// Menú de temas (respuestas locales = instantáneas). Un nodo con `options` abre un submenú.
// answer: texto o función({ account }). actions: botones bajo la respuesta ("topup" | "withdraw" | "contact" | "report").
const MENU = {
  client: [
    { label: "Mi servicio", options: [
      { label: "¿Dónde va mi prestador?", answer: "Mira el avance en tiempo real en Inicio → «Tu servicio» → Ver seguimiento. Ahí ves el mapa y puedes escribirle o llamarle." },
      { label: "No ha llegado", answer: "Revisa en Inicio → «Tu servicio» → Ver seguimiento dónde va. Si quieres, le aviso a tu prestador de tu retraso.", actions: ["contact"] },
      { label: "Cancelar o reprogramar", answer: "Cancelar o reprogramar se acuerda con tu prestador. Puedo enviarle tu mensaje; su respuesta puede tardar y la verás aquí.", actions: ["contact"] },
    ] },
    { label: "Objeto perdido", answer: "Lamento eso. Solo tu prestador puede confirmar si lo encontró. Puedo enviarle un aviso ahora mismo; su respuesta puede tardar, pero la verás aquí y te llegará una notificación.", actions: ["contact"] },
    { label: "Pagos y cobros", options: [
      { label: "Formas de pago", answer: "Puedes pagar en efectivo, con tarjeta, PayPal o con tu Monedero FlexiWash (3% de recompensa en servicios elegibles)." },
      { label: "Cobro que no reconozco", answer: "Lo registro al instante con un folio para que se revise. Pulsa el botón y cuéntame qué cobro ves (fecha y monto; nunca me envíes números de tarjeta).", actions: ["report"] },
    ] },
    { label: "Problema o daño", answer: "Lamento lo ocurrido. Puedo registrar un reporte con folio al instante, o avisarle a tu prestador si prefieres aclararlo con él.", actions: ["report", "contact"] },
    { label: "Calificar", answer: "Al finalizar el servicio aparece «Calificar servicio». Tus respuestas y comentario se muestran en el perfil del prestador y le generan insignias." },
    { label: "Facturas", answer: "Si contratas como empresa, FlexiWash emite una sola factura (CFDI) por el total con IVA. Captura tus datos fiscales en la sección Facturación de tu cuenta." },
  ],
  provider: [
    { label: "Mi saldo y comisión", answer: ({ account: a }) => a
      ? `Tu saldo disponible es $${a.balance} y tu comisión pendiente es $${a.debt} (límite $${a.debtLimit}). ${a.blocked ? `Estás bloqueado para solicitudes nuevas: recarga al menos $${Math.max(0, Math.round((a.debt - a.debtLimit) * 100) / 100)} para desbloquearte.` : "No estás bloqueado."} La comisión de efectivo se descuenta sola de tus ganancias; si no alcanza, puedes recargar saldo.`
      : "FlexiWash retiene 15% por servicio. En pagos en efectivo, la comisión se descuenta de tu saldo; si no alcanza, queda como adeudo y puedes recargar saldo en Ganancias → Recargar saldo.", actions: ["topup"] },
    { label: "Retiros", answer: ({ account: a }) => `Puedes retirar desde Ganancias a tu CLABE (18 dígitos) cuando llegues al mínimo de retiro${a?.minWithdraw ? ` ($${a.minWithdraw})` : ""}.`, actions: ["withdraw"] },
    { label: "Verificación", answer: "Tu identidad se valida con CURP, INE y selfie. Si tu cuenta fue rechazada o suspendida, registra un reporte para que la revisen.", actions: ["report"] },
    { label: "Insignias", answer: "Las insignias se otorgan solas según tus calificaciones: puntualidad, amabilidad, calidad y número de servicios." },
    { label: "Problema con un cliente", answer: "Cuéntame qué pasó y lo registro al instante con un folio.", actions: ["report"] },
    { label: "Calificación injusta", answer: "Las calificaciones no se borran automáticamente. Registra un reporte con lo que pasó y queda con folio para su revisión.", actions: ["report"] },
  ],
};
const ACTION_LABEL = { topup: "Ir a Recargar saldo", withdraw: "Ir a Retirar", contact: "Contactar a mi prestador", report: "Registrar un reporte" };
const HUMAN = /agente|humano|persona|asesor|operador/i;
const newFolio = () => `FW-${Date.now().toString(36).slice(-5).toUpperCase()}`;
const CSS = `.fws{position:absolute;inset:0;z-index:85;display:flex;flex-direction:column;background:var(--fw-surface,#fff)}.fws-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--fw-line,#dfe8e6)}.fws-head strong{font-size:15px}.fws-head span{display:block;font-size:12px;color:var(--fw-ink-soft,#5b7570)}.fws-x{width:36px;height:36px;border-radius:50%;border:1px solid var(--fw-line,#dfe8e6);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}.fws-list{flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--fw-bg,#eff7f5)}.fws-b{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.4;background:#fff;align-self:flex-start;border:1px solid var(--fw-line,#dfe8e6)}.fws-b.me{align-self:flex-end;background:var(--fw-teal,#0e9c8e);color:#fff;border-color:transparent}.fws-b small{display:block;opacity:.6;font-size:10px;margin-top:2px}.fws-act{display:block;margin-top:8px;padding:7px 12px;border-radius:10px;border:1px solid var(--fw-teal,#0e9c8e);background:#fff;color:var(--fw-teal,#0e9c8e);font-weight:700;font-size:12px;cursor:pointer}.fws-wait{display:flex;align-items:center;gap:5px;margin-top:8px;font-size:11px;font-weight:600;color:var(--fw-ink-soft,#5b7570)}.fws-reply{margin-top:8px;padding:8px 10px;border-radius:10px;background:var(--fw-teal-soft,#e6f4f3);font-size:13px}.fws-reply strong{display:block;font-size:11px;margin-bottom:2px}.fws-quick{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px 0}.fws-quick button{border:1px solid var(--fw-line,#dfe8e6);background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:12px;cursor:pointer}.fws-quick .human{background:var(--fw-teal,#0e9c8e);color:#fff;border-color:transparent}.fws-quick .cancel{color:#d64545;border-color:#d64545}.fws-form{display:flex;gap:8px;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 12px)}.fws-form input{flex:1;font:inherit;font-size:14px;padding:11px 14px;border:1px solid var(--fw-line,#dfe8e6);border-radius:999px;outline:none}.fws-send{width:42px;height:42px;border-radius:50%;border:none;background:var(--fw-teal,#0e9c8e);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}.fws-send:disabled{opacity:.4}`;

const hhmm = (ts) => new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

// threadId identifica la conversación (p. ej. "client-<dispositivo>" o "provider-<id>").
// orders (cliente): servicios recientes [{ reqId, service, when, providerName }]. focus: servicio desde el que se abrió la ayuda.
// account (prestador): { balance, debt, debtLimit, blocked, minWithdraw, minTopup, commissionPct } para responder con cifras reales.
// onAction(action): "topup" | "withdraw" → la app navega a esa pantalla.
// onOpenChat(reqId, providerName): abre el chat del servicio con el prestador (cierra la asistencia).
export default function SupportChat({ role = "client", threadId, name = "", orders = [], focus = null, account = null, onAction, onOpenChat, onClose }) {
  const all = useSupport();
  const allMsgs = useAllMessages();
  const list = all.filter((m) => m.threadId === threadId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [node, setNode] = useState(null);   // submenú abierto
  const [mode, setMode] = useState(null);   // null | { type: "pick" } | { type: "contact", reqId, providerName } | { type: "report" }
  const end = useRef(null);
  const isClient = role !== "provider";
  const menu = MENU[role] || MENU.client;
  const faq = FAQ[role] || FAQ.client;
  const firstName = name.split(" ")[0];
  const repliesFor = (p) => allMsgs.filter((x) => x.reqId === p.reqId && x.from === "provider" && x.ts > p.ts);
  const waiting = list.some((m) => m.pending && !repliesFor(m.pending).length);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [list.length, busy, allMsgs.length]);

  const say = (from, t, extra) => sendSupport({ threadId, role, name, from, text: t, ...extra });

  // ---- Reporte con folio (respuesta inmediata) ----
  const startReport = () => { setMode({ type: "report" }); say("bot", "Cuéntame en un mensaje qué pasó (fecha, servicio y detalles; nunca me envíes contraseñas ni números de tarjeta) y lo registro al instante con un folio."); };
  const registerReport = (reason) => {
    const folio = newFolio();
    setMode(null);
    say("bot", `Listo, tu reporte quedó registrado con el folio ${folio}. Guárdalo por si necesitas referirte a él. Si hay un riesgo para tu seguridad, llama al 911. Sigo aquí para lo que necesites.`, { report: { folio, reason: String(reason).slice(0, 300) } });
  };

  // ---- Contactar al prestador (lo único que espera respuesta) ----
  const chooseOrder = (o) => { setMode({ type: "contact", reqId: o.reqId, providerName: o.providerName || "" }); say("bot", `Escríbele tu mensaje a ${o.providerName || "tu prestador"} aquí abajo y se lo envío. Su respuesta puede tardar; mientras tanto sigo respondiendo al instante cualquier otra duda.`); };
  const startContact = () => {
    if (!isClient) return;
    if (!orders.length && !focus) return say("bot", "Para contactar a un prestador necesitas tener un servicio contratado. Cuando tengas uno, aquí podrás enviarle un mensaje.");
    const pick = focus?.reqId != null ? (orders.find((o) => o.reqId === focus.reqId) || focus) : orders.length === 1 ? orders[0] : null;
    if (pick) return chooseOrder(pick);
    setMode({ type: "pick" }); say("bot", "¿Con qué prestador quieres hablar? Elige el servicio:");
  };
  const deliver = (v) => {
    const { reqId, providerName } = mode;
    sendMessage(reqId, "client", `${firstName ? `${firstName} escribe` : "El cliente escribe"} desde Asistencia: ${v}`, { via: "assistant" });
    setMode(null);
    say("bot", `Listo, le envié tu mensaje a ${providerName || "tu prestador"}. Su respuesta puede tardar: la verás aquí mismo y te llegará una notificación. Mientras tanto, sigo aquí al instante para lo que necesites.`, { pending: { reqId, providerName, ts: Date.now() } });
  };

  const handleAction = (a) => {
    if (a === "topup" || a === "withdraw") return onAction?.(a);
    if (a === "contact") return startContact();
    if (a === "report") return startReport();
  };

  // ---- Menú: respuestas locales, sin esperas ----
  const pickNode = (n) => {
    say("user", n.label);
    if (n.options) { setNode(n); return say("bot", "Elige una opción:"); }
    const t = typeof n.answer === "function" ? n.answer({ account }) : n.answer;
    say("bot", t, n.actions ? { actions: n.actions } : undefined);
  };

  // ---- Texto libre: la IA responde en segundos; si falla, preguntas frecuentes ----
  const reply = async (v) => {
    const history = [...list, { from: "user", text: v }].slice(-12).map((m) => ({ from: m.from, text: m.text }));
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, name, history, orders, focus, account }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { reply: t, report, notify, action } = await r.json();
      if (!t) throw new Error("vacío");
      const extra = {};
      let out = t;
      // Aviso al prestador: llega a su pestaña «Mensajes»; aquí queda «Esperando respuesta» hasta que conteste.
      if (notify && orders.some((o) => o.reqId === notify.reqId)) {
        sendMessage(notify.reqId, "client", `${firstName ? `${firstName} reporta` : "El cliente reporta"}: ${notify.summary} Por favor contáctalo por este chat o por llamada.`, { via: "assistant" });
        extra.pending = { reqId: notify.reqId, providerName: notify.providerName || "", ts: Date.now() };
      }
      if (report) { const folio = newFolio(); out = `${t} Folio de tu reporte: ${folio}.`; extra.report = { folio, reason: String(report.reason || "").slice(0, 300) }; }
      if (action && ACTION_LABEL[action]) extra.actions = [action];
      say("bot", out, extra);
    } catch {
      const hit = faq.find(([re]) => re.test(v));
      say("bot", hit ? hit[1] : "No estoy seguro de haberte entendido. Elige un tema de abajo o cuéntame tu duda con más detalle.", { actions: hit?.[2] || ["report"] });
    } finally { setBusy(false); }
  };

  const send = (t = text) => {
    const v = t.trim(); if (!v || busy) return;
    setText(""); say("user", v);
    if (mode?.type === "contact") return deliver(v);
    if (mode?.type === "report") return registerReport(v);
    if (HUMAN.test(v)) return say("bot", "Aquí te atiendo yo, al instante y a cualquier hora. Cuéntame qué necesitas; si quieres dejar constancia de tu caso lo registro con un folio" + (isClient ? ", o contacto a tu prestador." : "."), { actions: isClient ? ["report", "contact"] : ["report"] });
    reply(v);
  };

  const placeholder = mode?.type === "contact" ? `Mensaje para ${mode.providerName || "tu prestador"}…` : mode?.type === "report" ? "Cuéntame qué pasó…" : "Escribe tu duda…";

  return (
    <div className="fws" role="dialog" aria-label="Chat de asistencia">
      <style>{CSS}</style>
      <div className="fws-head"><div><strong>Asistencia FlexiWash</strong><span>{waiting ? "Esperando respuesta de tu prestador · el asistente responde al instante" : "Respuestas al instante · 24/7"}</span></div><button className="fws-x" aria-label="Cerrar asistencia" onClick={onClose}><X size={18} /></button></div>
      <div className="fws-list" aria-live="polite">
        <div className="fws-b">Hola{firstName ? `, ${firstName}` : ""}. Soy el asistente de FlexiWash y te respondo al instante. {focus?.service ? `Veo que pides ayuda con tu servicio de ${focus.service}${focus.providerName ? ` con ${focus.providerName}` : ""}. ¿Qué pasó?` : "¿En qué te ayudo?"}</div>
        {list.map((m) => {
          const acts = (m.actions || (m.action ? [m.action] : [])).filter((a) => ACTION_LABEL[a] && (a === "contact" ? isClient : a === "topup" || a === "withdraw" ? !!onAction : true));
          const replies = m.pending ? repliesFor(m.pending) : [];
          const who = m.pending?.providerName || "tu prestador";
          return (
            <div key={m.id} className={`fws-b ${m.from === "user" ? "me" : ""}`}>
              {m.text}
              {acts.map((a) => <button key={a} type="button" className="fws-act" onClick={() => handleAction(a)}>{ACTION_LABEL[a]} ›</button>)}
              {m.pending && !replies.length && <div className="fws-wait"><Clock size={12} /> Esperando respuesta de {who}…</div>}
              {replies.slice(-3).map((r) => <div key={r.id} className="fws-reply"><strong>Respuesta de {who} · {hhmm(r.ts)}</strong>{r.text}</div>)}
              {replies.length > 0 && onOpenChat && <button type="button" className="fws-act" onClick={() => onOpenChat(m.pending.reqId, m.pending.providerName)}>Abrir chat con {who} ›</button>}
              <small>{hhmm(m.ts)}</small>
            </div>
          );
        })}
        {busy && <div className="fws-b" aria-label="Escribiendo">Escribiendo…</div>}
        <div ref={end} />
      </div>
      <div className="fws-quick">
        {mode?.type === "pick"
          ? orders.map((o) => <button key={o.reqId} onClick={() => { say("user", `${o.service || "Servicio"}${o.providerName ? ` · ${o.providerName}` : ""}`); chooseOrder(o); }}>{o.service || "Servicio"}{o.providerName ? ` · ${o.providerName}` : ""}</button>)
          : mode
            ? <button className="cancel" onClick={() => { setMode(null); say("bot", "Listo, cancelado. ¿En qué más te ayudo?"); }}>Cancelar</button>
            : <>
              {(node ? node.options : menu).map((n) => <button key={n.label} disabled={busy} onClick={() => pickNode(n)}>{n.label}</button>)}
              {node && <button onClick={() => setNode(null)}>‹ Menú</button>}
              {!node && isClient && <button className="human" disabled={busy} onClick={() => { say("user", "Quiero contactar a mi prestador"); startContact(); }}>Contactar a mi prestador</button>}
            </>}
      </div>
      <form className="fws-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} maxLength={mode?.type === "contact" ? 400 : 500} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Mensaje para asistencia" />
        <button className="fws-send" type="submit" disabled={!text.trim() || busy} aria-label="Enviar"><Send size={18} /></button>
      </form>
    </div>
  );
}
