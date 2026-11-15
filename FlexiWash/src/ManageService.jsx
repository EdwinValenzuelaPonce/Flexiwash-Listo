import React, { useMemo, useState } from "react";
import { reasonsFor, tiersFor, MIN_FEE, MAX_FEE } from "./cancelPolicy.js";

// Hoja (sheet) para que el CLIENTE cancele o reagende un servicio todavía no iniciado.
// El motivo es OBLIGATORIO y, junto con el tiempo que falta para el servicio, define si se cobra una comisión.
// Reutiliza las clases de la hoja de notificaciones (fw-notif-*) y de horarios (fw-slot*).
// Props:
//  - order: servicio del cliente ({ id, employee, slot, total, ... }) · paid: ¿se pagó en la app? (false = efectivo)
//  - quote(mode, reasonId): { fee, note } | null — calcula la comisión (cancelPolicy.feeQuote, definida en App.jsx)
//  - days / hours / slotOk(date, hour) / dayLabel / isoDate / pad: para elegir el nuevo horario
//  - onCancel(reasonId) · onReschedule(date, hour, reasonId) · onClose()
const money = (n) => Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function Reasons({ mode, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Motivo" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {reasonsFor(mode).map((r) => {
        const on = value === r.id;
        return (
          <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(r.id)}
            style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", font: "inherit", fontSize: 13, color: "var(--fw-ink)", background: on ? "var(--fw-teal-soft, #e6f4f3)" : "var(--fw-surface)", border: `1.5px solid ${on ? "var(--fw-teal-dark, #0B7F74)" : "var(--fw-line)"}`, borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
            <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: `2px solid ${on ? "var(--fw-teal-dark, #0B7F74)" : "var(--fw-line)"}`, background: on ? "var(--fw-teal-dark, #0B7F74)" : "transparent", boxShadow: on ? "inset 0 0 0 3px var(--fw-surface)" : "none" }} />
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function FeeBox({ q, mode }) {
  if (!q) return <p className="fw-muted" style={{ margin: 0 }}>Elige un motivo para ver si aplica una comisión.</p>;
  return (
    <div role="status" style={{ borderRadius: 12, padding: "10px 12px", fontSize: 13, background: q.fee > 0 ? "#FFF3E8" : "#E8F6EF", border: `1px solid ${q.fee > 0 ? "#F2C79B" : "#B7E2CC"}` }}>
      <strong>{q.fee > 0 ? `Comisión: ${money(q.fee)}` : "Sin comisión"}</strong>
      <br /><span className="fw-muted" style={{ fontSize: 12 }}>{q.note}</span>
    </div>
  );
}

const Policy = ({ mode }) => (
  <details style={{ fontSize: 12 }}>
    <summary style={{ cursor: "pointer", fontWeight: 700 }}>Política de {mode === "cancel" ? "cancelación" : "reagendado"}</summary>
    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
      {tiersFor(mode).map((t) => <li key={t.text}>{t.text}</li>)}
      <li>Sin comisión si el motivo es del prestador o si aún no confirma tu servicio.</li>
      <li>Imprevistos y errores al agendar pagan la mitad. Mínimo {money(MIN_FEE)}, máximo {money(MAX_FEE)}.</li>
    </ul>
  </details>
);

export default function ManageService({ order, initialMode = "cancel", paid = true, quote, days, hours, slotOk, dayLabel, isoDate, pad, onCancel, onReschedule, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [reason, setReason] = useState("");
  const offered = useMemo(() => days.map((d) => ({ d, hs: hours.filter((h) => slotOk(d, h)) })), [days, hours, slotOk]);
  const firstDay = offered.find((x) => x.hs.length)?.d || days[0];
  const [date, setDate] = useState(firstDay);
  const [hour, setHour] = useState(null);
  const hs = offered.find((x) => isoDate(x.d) === isoDate(date))?.hs || [];
  const anySlot = offered.some((x) => x.hs.length);
  const who = order?.employee?.name || "tu prestador";
  const current = order?.slot ? `${order.slot.label} · ${pad(order.slot.hour)}:00` : "";
  const q = reason ? quote(mode, reason) : null;
  const switchMode = (m) => { setMode(m); setReason(""); };

  const cancelMoney = !q ? null : paid
    ? (q.fee > 0 ? `Se reembolsarán ${money(order.total - q.fee)} a tu monedero (${money(order.total)} − comisión ${money(q.fee)}).` : `Se reembolsarán ${money(order.total)} a tu monedero.`)
    : (q.fee > 0 ? `Pagabas en efectivo: la comisión de ${money(q.fee)} se descontará de tu monedero.` : "Pagabas en efectivo, así que no se te cobrará nada.");

  return (
    <div className="fw-notif-sheet">
      <button className="fw-notif-back" aria-label="Cerrar" onClick={onClose} />
      <div className="fw-notif-panel" role="dialog" aria-label={mode === "cancel" ? "Cancelar servicio" : "Reagendar servicio"}>
        <div className="fw-notif-head">
          <strong>{mode === "cancel" ? "Cancelar servicio" : "Reagendar servicio"} · #{order?.id}</strong>
          <button className="fw-linklike" onClick={onClose}>Cerrar</button>
        </div>

        {mode === "cancel" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p>¿Seguro que quieres cancelar tu servicio con {who}{current ? ` (${current})` : ""}?</p>
            <p className="fwp-label">Motivo de la cancelación (obligatorio)</p>
            <Reasons mode="cancel" value={reason} onChange={setReason} />
            <FeeBox q={q} mode="cancel" />
            {cancelMoney && <p>{cancelMoney}</p>}
            <Policy mode="cancel" />
            <button className="fw-btn-primary fw-btn-block" style={{ background: "#D64545", borderColor: "#D64545" }} disabled={!reason} onClick={() => onCancel(reason)}>
              {q?.fee > 0 ? `Cancelar y pagar comisión de ${money(q.fee)}` : "Sí, cancelar servicio"}
            </button>
            <button className="fw-btn-outline fw-btn-block" onClick={onClose}>Conservar mi servicio</button>
            <button className="fw-linklike" onClick={() => switchMode("reschedule")}>Mejor reagendar para otro día u hora</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p>Elige un nuevo horario con {who}. Él o ella deberá confirmarlo de nuevo.{current ? ` Horario actual: ${current}.` : ""}</p>
            <p className="fwp-label">Motivo del cambio (obligatorio)</p>
            <Reasons mode="reschedule" value={reason} onChange={setReason} />
            <FeeBox q={q} mode="reschedule" />
            {q?.fee > 0 && <p>La comisión de {money(q.fee)} se descontará de tu monedero al confirmar.</p>}
            <Policy mode="reschedule" />
            {!anySlot ? (
              <p className="fw-muted" role="status">{who} no tiene horarios libres en los próximos días. Puedes cancelar el servicio y solicitarlo con otro prestador.</p>
            ) : (
              <>
                <div className="fw-slots fw-slots--days" role="group" aria-label="Nueva fecha">
                  {offered.map(({ d, hs: h }) => (
                    <button key={isoDate(d)} disabled={!h.length} className={`fw-slot ${isoDate(d) === isoDate(date) ? "is-on" : ""}`} onClick={() => { setDate(d); setHour(null); }}>{dayLabel(d)}</button>
                  ))}
                </div>
                <div className="fw-slots" role="group" aria-label="Nueva hora">
                  {hs.map((h) => (
                    <button key={h} className={`fw-slot ${hour === h ? "is-on" : ""}`} onClick={() => setHour(h)}>{pad(h)}:00</button>
                  ))}
                </div>
              </>
            )}
            <button className="fw-btn-primary fw-btn-block" disabled={hour == null || !reason} onClick={() => onReschedule(date, hour, reason)}>
              {q?.fee > 0 ? `Confirmar y pagar comisión de ${money(q.fee)}` : "Confirmar nuevo horario"}
            </button>
            <button className="fw-linklike" onClick={() => switchMode("cancel")}>Prefiero cancelar el servicio</button>
          </div>
        )}
      </div>
    </div>
  );
}
