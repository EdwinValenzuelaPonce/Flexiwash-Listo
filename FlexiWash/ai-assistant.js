// Lógica del asistente de IA de FlexiWash (compartida por server.js y api/assistant.js).
// La llave ANTHROPIC_API_KEY vive solo en el servidor: nunca se envía al navegador.
// El asistente atiende 24/7. Con la herramienta notify_provider avisa al prestador de un servicio
// (p. ej. objeto perdido) y con escalate_to_agent pasa el caso a una persona; las demás dudas las resuelve él.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5"; // Haiku: respuestas rápidas

const BASE = `Eres el asistente virtual de soporte de FlexiWash, una app mexicana que conecta clientes con prestadores de servicios de limpieza (autos, hogar y muebles).
Estás disponible las 24 horas, todos los días: nunca menciones horarios de atención ni digas que "no hay nadie".
Responde SIEMPRE en español de México, con tono amable y directo, en máximo 3 oraciones cortas. Sin markdown.
Datos de la plataforma:
- Pagos del cliente: efectivo, tarjeta, PayPal o Monedero FlexiWash (3% de recompensa en servicios elegibles).
- Seguimiento: Inicio → «Tu servicio» → Ver seguimiento; desde ahí puede escribir o llamar a su prestador.
- Al finalizar el servicio aparece «Calificar servicio»; la calificación y el comentario se muestran en el perfil del prestador y le generan insignias.
- Empresas: FlexiWash emite una sola factura (CFDI) por el total con IVA.
Reglas generales:
- Resuelve tú las dudas (pagos, seguimiento, calificaciones, cuenta, cómo usar la app). Si no sabes algo, dilo; no inventes precios, políticas ni plazos.
- No pidas ni aceptes contraseñas, PIN, números completos de tarjeta ni CLABE.
- Usa escalate_to_agent solo para cobros no reconocidos, robo, acoso, accidentes o asuntos graves que no puedas resolver; avisa brevemente que un agente revisará el caso.`;

const ROLE = {
  client: "Estás hablando con un CLIENTE.",
  provider: "Estás hablando con un PRESTADOR. Ayuda con retiros a CLABE (mínimo de retiro, CLABE de 18 dígitos), comisión de 15% por servicio, adeudos por pagos en efectivo (se compensan con saldos y pueden bloquear nuevas solicitudes), verificación de identidad (CURP, INE, selfie), contrato e insignias.",
};

const LOST = `Objetos perdidos y asuntos que solo el prestador del servicio puede aclarar (olvidé algo, ¿lo encontró?, ¿pasó algo con mis pertenencias durante el servicio?):
1) Si hay varios servicios recientes y no es claro cuál, pregunta cuál (por número o nombre del prestador).
2) Pregunta qué objeto es y dónde cree que lo dejó, una pregunta a la vez.
3) Con el servicio identificado y una descripción suficiente, llama a notify_provider con un resumen claro para el prestador.
4) Después explica que el prestador ya fue notificado y se comunicará con el cliente directamente por el chat del servicio o por llamada (recibirá una notificación en la app), y que tú sigues disponible para otras dudas. No prometas que el objeto aparecerá.
5) Si ya avisaste al prestador por ese asunto en esta conversación, no vuelvas a llamar la herramienta: pide que espere su respuesta.`;

const TOOLS = {
  escalate_to_agent: {
    name: "escalate_to_agent",
    description: "Pasa el caso a un agente humano de FlexiWash. Úsala solo para asuntos graves que no puedas resolver.",
    input_schema: { type: "object", properties: { reason: { type: "string", description: "Motivo breve" } }, required: ["reason"] },
  },
  notify_provider: {
    name: "notify_provider",
    description: "Notifica al prestador de un servicio del cliente para que lo contacte directamente (objeto perdido u otro asunto que solo el prestador pueda aclarar).",
    input_schema: {
      type: "object",
      properties: {
        reqId: { type: "integer", description: "Número del servicio (de la lista de servicios del cliente)" },
        summary: { type: "string", description: "Qué necesita el cliente, en una o dos oraciones claras para el prestador (objeto, dónde lo dejó, cuándo). Máx. 250 caracteres." },
      },
      required: ["reqId", "summary"],
    },
  },
};

// history: [{ from: "user"|"bot"|"agent", text }] -> mensajes alternados user/assistant que empiezan con user.
function toMessages(history) {
  const out = [];
  for (const m of (Array.isArray(history) ? history : []).slice(-12)) {
    const role = m?.from === "user" ? "user" : "assistant";
    const content = String(m?.text || "").trim().slice(0, 500);
    if (!content) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n" + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// orders: [{ reqId, service, when, providerName }] — servicios recientes del cliente (máx. 5).
function cleanOrders(orders) {
  return (Array.isArray(orders) ? orders : []).slice(0, 5)
    .map((o) => ({ reqId: Number(o?.reqId), service: String(o?.service || "").slice(0, 80), when: String(o?.when || "").slice(0, 30), providerName: String(o?.providerName || "").slice(0, 40) }))
    .filter((o) => Number.isFinite(o.reqId));
}

export async function askAssistant({ role, name, history, orders }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("Falta ANTHROPIC_API_KEY"), { code: 503 });
  const messages = toMessages(history);
  if (!messages.length || messages[messages.length - 1].role !== "user") throw Object.assign(new Error("Mensaje vacío"), { code: 400 });
  const isClient = role !== "provider";
  const list = isClient ? cleanOrders(orders) : [];
  const who = String(name || "").split(" ")[0].slice(0, 30);
  const system = [
    BASE, ROLE[isClient ? "client" : "provider"],
    isClient && list.length ? `${LOST}\nServicios recientes del cliente:\n${list.map((o) => `- #${o.reqId}: ${o.service || "servicio"}${o.when ? ` (${o.when})` : ""}${o.providerName ? ` con ${o.providerName}` : ""}`).join("\n")}` : "",
    isClient && !list.length ? "El cliente no tiene servicios registrados en este dispositivo: si pregunta por un objeto perdido, explícale que necesita haber contratado un servicio para poder contactar al prestador." : "",
    who ? `La persona se llama ${who}.` : "",
  ].filter(Boolean).join("\n");
  const tools = [TOOLS.escalate_to_agent, ...(isClient && list.length ? [TOOLS.notify_provider] : [])];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, system, tools, messages }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Object.assign(new Error(`IA HTTP ${r.status}`), { code: 502 });
  const data = await r.json();
  const blocks = data.content || [];
  let reply = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  let escalate = false, notify = null;
  for (const b of blocks.filter((x) => x.type === "tool_use")) {
    if (b.name === "escalate_to_agent") escalate = true;
    if (b.name === "notify_provider" && !notify) {
      const o = list.find((x) => x.reqId === Number(b.input?.reqId)); // solo servicios de este cliente
      const summary = String(b.input?.summary || "").trim().slice(0, 250);
      if (o && summary) notify = { reqId: o.reqId, providerName: o.providerName, summary };
    }
  }
  if (!reply && notify) reply = `Listo, avisé a ${notify.providerName || "tu prestador"} sobre tu caso. Te contactará directamente por el chat del servicio o por llamada, y te llegará una notificación en la app. Mientras tanto, sigo aquí para lo que necesites.`;
  if (!reply && escalate) reply = "Listo, avisé a un agente para que revise tu caso. Te responderá en este mismo chat; mientras tanto, cuéntame todos los detalles que puedas.";
  reply = reply.slice(0, 500);
  if (!reply) throw Object.assign(new Error("Respuesta vacía"), { code: 502 });
  return { reply, escalate, notify };
}
