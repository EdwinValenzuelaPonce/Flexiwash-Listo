// Saldo por prestador: ganancias, comisión adeudada por servicios en efectivo y límite de deuda.
//  - Servicio pagado en la app (tarjeta, PayPal, monedero): FlexiWash cobra y le abona al prestador el neto (precio − comisión).
//  - Servicio en efectivo: el prestador cobra todo y DEBE la comisión a FlexiWash. Se registra al ACEPTAR el servicio.
//  - La deuda se descuenta automáticamente de lo que FlexiWash le debe al prestador (servicios con tarjeta).
//    Si solo cobra en efectivo, la deuda se acumula; al pasar DEBT_LIMIT no puede recibir solicitudes nuevas hasta pagar.
export const COMMISSION = 0.15;   // comisión FlexiWash sobre el precio del servicio
export const DEBT_LIMIT = 300;    // deuda pendiente máxima (MXN); arriba de esto se bloquean solicitudes nuevas
export const MIN_WITHDRAW = 100;
export const BASE_BALANCE = 4850; // saldo inicial de DEMO del primer prestador del equipo

const r2 = (n) => Math.round(n * 100) / 100;
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);
export const commissionOf = (price) => r2(price * COMMISSION);
export const netOf = (price) => r2(price - commissionOf(price));
export const baseFor = (id, team) => (id === team[0]?.id ? BASE_BALANCE : 0);
export const isCash = (r) => r?.payMethod === "efectivo";

// requests: solicitudes compartidas · ledger: movimientos [{ providerId, kind: "withdrawal" | "debt_payment", amount, ... }]
export function providerLedger({ providerId, requests, ledger, base = 0 }) {
  const mine = requests.filter((r) => r.providerId === providerId);
  const cashJobs = mine.filter((r) => isCash(r) && (r.status === "accepted" || r.status === "done"));
  const paidJobs = mine.filter((r) => !isCash(r) && r.status === "done"); // sin payMethod (solicitudes viejas) = pagado en la app
  const rows = ledger.filter((l) => l.providerId === providerId);
  const cashOwed = r2(sum(cashJobs, (r) => commissionOf(r.price)));
  const credited = r2(sum(paidJobs, (r) => netOf(r.price)));
  const withdrawn = r2(sum(rows.filter((l) => l.kind === "withdrawal"), (l) => l.amount));
  const debtPaid = r2(sum(rows.filter((l) => l.kind === "debt_payment"), (l) => l.amount));
  const gross = r2(base + credited - withdrawn);            // lo que FlexiWash le debe al prestador, antes de descontar deuda
  const debtGross = Math.max(0, r2(cashOwed - debtPaid));    // comisión en efectivo aún no pagada
  const offset = r2(Math.min(Math.max(gross, 0), debtGross)); // parte de la deuda que se descuenta de sus ganancias
  const debt = r2(debtGross - offset);                       // deuda pendiente que sí debe pagar
  return { balance: r2(gross - offset), debt, offset, cashOwed, debtPaid, withdrawn, credited, cashJobs, blocked: debt > DEBT_LIMIT };
}
