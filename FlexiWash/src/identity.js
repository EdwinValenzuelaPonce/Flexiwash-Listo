// Validación de identidad del prestador.
// DEMO: son verificaciones LOCALES (formato, dígito verificador de la CURP, mayoría de edad, clave y vigencia de INE).
// No consulta RENAPO ni el INE. Para producción, reemplaza `verifyIdentity` por un proveedor KYC
// (p. ej. Truora, Metamap, Mati) o por la consulta oficial, y guarda las fotos en un bucket PRIVADO.
import { validCurp, DEMO_MODE } from "./validators.js";

const DICT = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

// Dígito verificador oficial de la CURP (posición 18).
export function curpDigitOk(curp) {
  const c = curp.trim().toUpperCase();
  if (c.length !== 18) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) { const v = DICT.indexOf(c[i]); if (v < 0) return false; sum += v * (18 - i); }
  return String((10 - (sum % 10)) % 10) === c[17];
}

// Edad calculada con la fecha de nacimiento de la CURP (posición 17 numérica = 1900s, letra = 2000s).
export function curpAge(curp) {
  const c = curp.trim().toUpperCase();
  const yy = +c.slice(4, 6), mm = +c.slice(6, 8), dd = +c.slice(8, 10);
  const year = (/\d/.test(c[16]) ? 1900 : 2000) + yy;
  const d = new Date(year, mm - 1, dd);
  if (d.getFullYear() !== year || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now < new Date(now.getFullYear(), mm - 1, dd)) age--;
  return age;
}

export const validClaveElector = (v) => /^[A-Z]{6}\d{8}[HM]\d{3}$/.test(v.trim().toUpperCase());
export const validVigencia = (v) => { const y = +v; return /^\d{4}$/.test(String(v)) && y >= new Date().getFullYear() && y <= new Date().getFullYear() + 15; };

// Devuelve { status: "verified" | "rejected", checks: [{ id, label, ok }] }.
export async function verifyIdentity({ curp, claveElector, vigencia, docs }) {
  const age = validCurp(curp) ? curpAge(curp) : null;
  const checks = [
    { id: "curp", label: "CURP con formato válido", ok: validCurp(curp) },
    { id: "curpDigit", label: DEMO_MODE ? "Dígito verificador de la CURP (omitido en modo demo)" : "Dígito verificador de la CURP", ok: DEMO_MODE || curpDigitOk(curp) },
    { id: "age", label: "Mayor de 18 años", ok: age != null && age >= 18 },
    { id: "elector", label: "Clave de elector con formato válido", ok: validClaveElector(claveElector) },
    { id: "vigencia", label: "INE vigente", ok: validVigencia(vigencia) },
    { id: "front", label: "Foto del INE (frente)", ok: !!docs.front },
    { id: "back", label: "Foto del INE (reverso)", ok: !!docs.back },
    { id: "selfie", label: "Selfie sosteniendo el INE", ok: !!docs.selfie },
  ];
  return { status: checks.every((c) => c.ok) ? "verified" : "rejected", checks };
}
