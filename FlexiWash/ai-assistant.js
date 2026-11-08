// Lógica del asistente de IA de FlexiWash (compartida por server.js y api/assistant.js).
// La llave ANTHROPIC_API_KEY vive solo en el servidor: nunca se envía al navegador.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5"; // Haiku: respuestas rápidas
const MARKER = "[AGENTE]";

const BASE = `Eres el asistente virtual de soporte de FlexiWash, una app mexicana que conecta clientes con prestadores de servicios de limpieza (autos, hogar y muebles).
Responde SIEMPRE en español de México, con tono amable y directo, en máximo 3 oraciones cortas. Sin markdown.
Datos de la plataforma:
- Pagos del cliente: efectivo, tarjeta, PayPal o Monedero FlexiWash (3% de recompensa en servicios elegibles).
- Seguimiento: Inicio → «Tu servicio» → Ver seguimiento; desde ahí puede escribir o llamar al prestador.
- Al finalizar el servicio aparece «Calificar servicio»; la calificación y el comentario se muestran en el perfil del prestador y le generan insignias.
- Precio de muebles según tamaño y material; precio de Hogar según las áreas seleccionadas.
- Empresas: FlexiWash emite una sola factura (CFDI) por el total con IVA.
- Atención humana: lunes a sábado, 9:00 a 18:00.
Reglas:
- Si no sabes algo, dilo; no inventes precios, políticas ni plazos.
- No pidas ni aceptes contraseñas, PIN, números completos de tarjeta ni CLABE.
- Si la persona pide un agente humano, reporta un cobro no reconocido, un daño, robo, acoso, o el tema excede lo que sabes, responde brevemente que avisarás a un agente y termina tu mensaje con ${MARKER}.`;

const ROLE = {
  client: "Estás hablando con un CLIENTE. Ayuda con pagos, seguimiento de servicios, calificaciones y problemas con un servicio.",
  provider: "Estás hablando con un PRESTADOR. Ayuda con retiros a CLABE (mínimo de retiro, CLABE de 18 dígitos), comisión de 15% por servicio, adeudos por pagos en efectivo (se compensan con saldos y pueden bloquear nuevas solicitudes), verificación de identidad (CURP, INE, selfie), contrato e insignias.",
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

export async function askAssistant({ role, name, history }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("Falta ANTHROPIC_API_KEY"), { code: 503 });
  const messages = toMessages(history);
  if (!messages.length || messages[messages.length - 1].role !== "user") throw Object.assign(new Error("Mensaje vacío"), { code: 400 });
  const who = String(name || "").split(" ")[0].slice(0, 30);
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: `${BASE}\n${ROLE[role] || ROLE.client}${who ? `\nLa persona se llama ${who}.` : ""}`,
      messages,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Object.assign(new Error(`IA HTTP ${r.status}`), { code: 502 });
  const data = await r.json();
  let reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const escalate = reply.includes(MARKER);
  reply = reply.replace(MARKER, "").trim().slice(0, 500);
  if (!reply) throw Object.assign(new Error("Respuesta vacía"), { code: 502 });
  return { reply, escalate };
}
