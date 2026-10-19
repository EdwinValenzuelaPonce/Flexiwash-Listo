// Modo demostración: acepta cualquier número de 16 dígitos (sin Luhn) para poder simular pagos.
// Ponlo en false cuando conectes una pasarela real.
export const DEMO_MODE = true;
export const testCard = () => ({ nombre: "Cliente Prueba", numero: "4242 4242 4242 4242", exp: `12/${String((new Date().getFullYear() + 2) % 100).padStart(2, "0")}`, cvv: "123" });
export const onlyDigits = (v) => v.replace(/\D/g, "");
export const formatCardNumber = (v) => onlyDigits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
export const formatExp = (v) => { const d = onlyDigits(v).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
export const luhn = (num) => {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) { let n = +num[i]; if (alt && (n *= 2) > 9) n -= 9; sum += n; alt = !alt; }
  return num.length > 0 && sum % 10 === 0;
};
export const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const validPhone = (v) => onlyDigits(v).length === 10;

export function validateCard({ nombre, numero, exp, cvv }) {
  const e = {};
  if (nombre.trim().length < 3 || !/^[\p{L}\s.'-]+$/u.test(nombre.trim())) e.nombre = "Escribe el nombre como aparece en la tarjeta.";
  const n = onlyDigits(numero);
  if (n.length !== 16 || (!DEMO_MODE && !luhn(n))) e.numero = "Número de tarjeta inválido.";
  const m = /^(\d{2})\/(\d{2})$/.exec(exp);
  const now = new Date();
  if (!m || +m[1] < 1 || +m[1] > 12) e.exp = "Usa el formato MM/AA.";
  else if (2000 + +m[2] < now.getFullYear() || (2000 + +m[2] === now.getFullYear() && +m[1] < now.getMonth() + 1)) e.exp = "Tarjeta vencida.";
  if (!/^\d{3,4}$/.test(cvv)) e.cvv = "CVV de 3 o 4 dígitos.";
  return e;
}
export function validateAddress({ label, street, colonia, cp }) {
  const e = {};
  if (!label.trim()) e.label = "Ponle un nombre (Casa, Trabajo…).";
  if (street.trim().length < 5 || !/\d/.test(street)) e.street = "Incluye calle y número.";
  if (colonia.trim().length < 3) e.colonia = "Escribe la colonia.";
  if (!/^\d{5}$/.test(cp)) e.cp = "Código postal de 5 dígitos.";
  return e;
}
// CURP: 18 caracteres (4 letras, fecha AAMMDD, sexo H/M/X, entidad, 3 consonantes, homoclave, dígito).
export const validCurp = (v) => /^[A-Z]{4}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/.test(v.trim().toUpperCase());
