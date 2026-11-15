// Política de cancelación y reagendado (cliente). TODO lo ajustable está en las constantes de arriba.
//
// Comisión = % del total del servicio según el tiempo que falta para el horario agendado, ajustado por el motivo:
//  · Sin comisión: motivo atribuible al prestador, o el prestador aún no confirma el servicio, o hay suficiente anticipación.
//  · Motivos «atenuantes» (imprevisto, error al agendar) pagan la mitad.
//  · La comisión nunca baja de MIN_FEE ni sube de MAX_FEE, ni supera el total del servicio.
export const MIN_FEE = 15;   // MXN
export const MAX_FEE = 100;  // MXN

// by: "client" | "provider" (provider = no se cobra) · factor: multiplicador de la comisión (0.5 = mitad)
export const CANCEL_REASONS = [
  { id: "no_need", label: "Ya no lo necesito", by: "client", factor: 1 },
  { id: "other_option", label: "Encontré otra opción", by: "client", factor: 1 },
  { id: "mistake", label: "Me equivoqué de horario o servicio", by: "client", factor: 0.5 },
  { id: "emergency", label: "Imprevisto o emergencia", by: "client", factor: 0.5 },
  { id: "provider_late", label: "El prestador tarda o no responde", by: "provider", factor: 0 },
  { id: "provider_asked", label: "El prestador me pidió cancelar", by: "provider", factor: 0 },
  { id: "other", label: "Otro motivo", by: "client", factor: 1 },
];
export const RESCHEDULE_REASONS = [
  { id: "plans", label: "Cambio de planes", by: "client", factor: 1 },
  { id: "mistake", label: "Me equivoqué de horario", by: "client", factor: 0.5 },
  { id: "emergency", label: "Imprevisto o emergencia", by: "client", factor: 0.5 },
  { id: "provider_asked", label: "El prestador me pidió reagendar", by: "provider", factor: 0 },
  { id: "other", label: "Otro motivo", by: "client", factor: 1 },
];

// minHours: horas de anticipación mínimas para que aplique el tramo (de mayor a menor).
export const CANCEL_TIERS = [
  { minHours: 24, pct: 0, text: "24 h o más antes del servicio: sin comisión" },
  { minHours: 6, pct: 0.05, text: "De 6 a 24 h antes: 5 %" },
  { minHours: 2, pct: 0.10, text: "De 2 a 6 h antes: 10 %" },
  { minHours: -Infinity, pct: 0.15, text: "Menos de 2 h antes: 15 %" },
];
export const RESCHEDULE_TIERS = [
  { minHours: 12, pct: 0, text: "12 h o más antes del servicio: sin comisión" },
  { minHours: 4, pct: 0.05, text: "De 4 a 12 h antes: 5 %" },
  { minHours: -Infinity, pct: 0.10, text: "Menos de 4 h antes: 10 %" },
];

const r2 = (n) => Math.round(n * 100) / 100;
export const reasonsFor = (action) => (action === "cancel" ? CANCEL_REASONS : RESCHEDULE_REASONS);
export const tiersFor = (action) => (action === "cancel" ? CANCEL_TIERS : RESCHEDULE_TIERS);

// Horas que faltan para el servicio. slot = { date: "YYYY-MM-DD", hour }.
export const hoursUntil = (slot, now = new Date()) => {
  if (!slot?.date) return Infinity;
  const [y, m, d] = slot.date.split("-").map(Number);
  return (new Date(y, m - 1, d, slot.hour || 0).getTime() - now.getTime()) / 3600000;
};

// Calcula la comisión. Devuelve null mientras no haya motivo elegido.
//  action: "cancel" | "reschedule" · accepted: el prestador ya confirmó el servicio
// → { fee, pct, hours, note } · note explica por qué se cobra o por qué no.
export function feeQuote({ action, reasonId, total, slot, accepted, now = new Date() }) {
  const reason = reasonsFor(action).find((r) => r.id === reasonId);
  if (!reason) return null;
  const hours = hoursUntil(slot, now);
  const free = (note) => ({ fee: 0, pct: 0, hours, note });
  if (reason.by === "provider") return free("Sin comisión: el motivo se debe al prestador.");
  if (!accepted) return free("Sin comisión: tu prestador aún no confirma el servicio.");
  const tier = tiersFor(action).find((t) => hours >= t.minHours);
  if (!tier || tier.pct === 0) return free(`Sin comisión: ${tier ? tier.text.split(":")[0].toLowerCase() : "hay suficiente anticipación"}.`);
  const pct = tier.pct * reason.factor;
  const fee = Math.min(total, Math.min(MAX_FEE, Math.max(MIN_FEE, r2(total * pct))));
  const why = reason.factor < 1 ? `${tier.text.split(":")[0]}, con descuento por «${reason.label.toLowerCase()}»` : tier.text.split(":")[0];
  return { fee: r2(fee), pct, hours, note: `Comisión por ${action === "cancel" ? "cancelar" : "reagendar"}: ${why}.` };
}
