// Facturación. FlexiWash emite UNA sola factura (CFDI) a la empresa por el total, con IVA, y después le paga al prestador.
// Los precios que se muestran en la app YA incluyen IVA; el CFDI desglosa subtotal + IVA 16%.
// DEMO: `issueInvoice` NO timbra. En producción reemplázalo por un PAC (Facturama, SW Sapien, Finkok...) que devuelva UUID y XML/PDF.
export const IVA_RATE = 0.16;
const r2 = (n) => Math.round(n * 100) / 100;

export const breakdown = (total) => { const subtotal = r2(total / (1 + IVA_RATE)); return { subtotal, iva: r2(total - subtotal), total: r2(total) }; };

export const REGIMENES = [
  ["601", "General de Ley Personas Morales"], ["603", "Personas Morales con Fines no Lucrativos"],
  ["612", "Personas Físicas con Actividades Empresariales y Profesionales"], ["621", "Incorporación Fiscal"],
  ["626", "Régimen Simplificado de Confianza (RESICO)"], ["616", "Sin obligaciones fiscales"],
];
export const USOS_CFDI = [["G03", "Gastos en general"], ["G01", "Adquisición de mercancías"], ["S01", "Sin efectos fiscales"], ["P01", "Por definir"]];

export const validRfc = (v) => /^([A-ZÑ&]{3}|[A-ZÑ&]{4})\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/.test(v.trim().toUpperCase());
export const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const emptyFiscal = { razon: "", rfc: "", regimen: "601", uso: "G03", cp: "", email: "" };
export function fiscalErrors(f) {
  const e = {};
  if (f.razon.trim().length < 3) e.razon = "Escribe la razón social tal como aparece en tu constancia fiscal.";
  if (!validRfc(f.rfc)) e.rfc = "RFC inválido (12 caracteres para empresas, 13 para personas físicas).";
  if (!/^\d{5}$/.test(f.cp)) e.cp = "Código postal fiscal de 5 dígitos.";
  if (!validEmail(f.email)) e.email = "Correo inválido.";
  return e;
}

export async function issueInvoice({ fiscal, orders }) {
  const total = r2(orders.reduce((s, o) => s + o.total, 0));
  const uuid = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).toUpperCase();
  return { ...breakdown(total), uuid, status: "Emitida (demo)" };
}
