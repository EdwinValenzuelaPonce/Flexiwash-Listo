import React, { useMemo, useState } from "react";

// Hoja (sheet) para que el CLIENTE cancele o reagende un servicio todavía no iniciado.
// Reutiliza las clases de la hoja de notificaciones (fw-notif-*) y de horarios (fw-slot*), así que no requiere CSS nuevo.
// Props:
//  - order: servicio del cliente ({ id, employee, slot, ... })
//  - initialMode: "cancel" | "reschedule"
//  - days: [Date] días ofrecidos · hours: [number] horas posibles
//  - slotOk(date, hour): ¿ese horario está libre en la agenda del prestador?
//  - dayLabel(date), isoDate(date), pad(n): helpers de formato de App.jsx
//  - refundText: texto que explica el reembolso al cancelar
//  - onCancel(reason) · onReschedule(date, hour) · onClose()
const REASONS = ["Ya no lo necesito", "Me equivoqué de horario o servicio", "Encontré otra opción", "Otro motivo"];

export default function ManageService({ order, initialMode = "cancel", days, hours, slotOk, dayLabel, isoDate, pad, refundText, onCancel, onReschedule, onClose }) {
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

  return (
    <div className="fw-notif-sheet">
      <button className="fw-notif-back" aria-label="Cerrar" onClick={onClose} />
      <div className="fw-notif-panel" role="dialog" aria-label={mode === "cancel" ? "Cancelar servicio" : "Reagendar servicio"}>
        <div className="fw-notif-head">
          <strong>{mode === "cancel" ? "Cancelar servicio" : "Reagendar servicio"} · #{order?.id}</strong>
          <button className="fw-linklike" onClick={onClose}>Cerrar</button>
        </div>

        {mode === "cancel" ? (
          <div className="fwp-col" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p>¿Seguro que quieres cancelar tu servicio con {who}{current ? ` (${current})` : ""}?</p>
            <p>{refundText}</p>
            <div className="fwp-chips" role="group" aria-label="Motivo (opcional)" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {REASONS.map((r) => (
                <button key={r} type="button" className={`fwp-chip ${reason === r ? "is-on" : ""}`} aria-pressed={reason === r} onClick={() => setReason(reason === r ? "" : r)}>{r}</button>
              ))}
            </div>
            <button className="fw-btn-primary fw-btn-block" style={{ background: "#D64545", borderColor: "#D64545" }} onClick={() => onCancel(reason)}>Sí, cancelar servicio</button>
            <button className="fw-btn-outline fw-btn-block" onClick={onClose}>Conservar mi servicio</button>
            <button className="fw-linklike" onClick={() => setMode("reschedule")}>Mejor reagendar para otro día u hora</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p>Elige un nuevo horario con {who}. Él o ella deberá confirmarlo de nuevo.{current ? ` Horario actual: ${current}.` : ""}</p>
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
            <button className="fw-btn-primary fw-btn-block" disabled={hour == null} onClick={() => onReschedule(date, hour)}>Confirmar nuevo horario</button>
            <button className="fw-linklike" onClick={() => setMode("cancel")}>Prefiero cancelar el servicio</button>
          </div>
        )}
      </div>
    </div>
  );
}
