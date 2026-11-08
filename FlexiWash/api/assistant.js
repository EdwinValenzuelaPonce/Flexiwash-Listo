// Función serverless para Vercel: POST /api/assistant  (en Vercel define ANTHROPIC_API_KEY en Settings → Environment Variables).
import { askAssistant } from "../ai-assistant.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    const { role, name, history, orders, focus, account } = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    res.status(200).json(await askAssistant({ role, name, history, orders, focus, account }));
  } catch (e) {
    res.status(e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message });
  }
}
