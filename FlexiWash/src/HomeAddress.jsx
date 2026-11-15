import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, MapPin, Plus, Check, LocateFixed } from "lucide-react";
import { addrLine } from "./geocode.js";

// Dirección de la esquina superior izquierda del Inicio. Al tocarla se despliega la lista de direcciones
// guardadas del cliente: puede elegir con cuál pedir el servicio, o agregar/administrar direcciones.
// Props: addresses [{ id, label, street, colonia, cp, ref, lat?, lng?, gps? }], selectedId, onSelect(id), onManage(),
//        onLocate(): Promise<{ ok, error? }> — agrega y selecciona «Ubicación actual» con el GPS del dispositivo
export default function HomeAddress({ addresses = [], selectedId, onSelect, onManage, onLocate }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef(null);
  const current = addresses.find((a) => a.id === selectedId) || addresses[0];

  // Se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const outside = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  const manage = () => { setOpen(false); onManage?.(); };
  const locate = async () => {
    setBusy(true); setErr("");
    const r = await onLocate();
    setBusy(false);
    if (r?.ok) setOpen(false); else setErr(r?.error || "No pudimos obtener tu ubicación.");
  };

  return (
    <div ref={box} style={{ position: "relative", minWidth: 0, maxWidth: "62%" }}>
      <button className="fw-addr" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setErr(""); setOpen((v) => !v); }} style={{ maxWidth: "100%" }}>
        <MapPin size={15} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current ? (current.gps ? "Ubicación actual" : `${current.label} · ${current.street}`) : "Agregar dirección"}
        </span>
        <ChevronLeft size={14} className="fw-rot" style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }} />
      </button>

      {open && (
        <div role="listbox" aria-label="Mis direcciones" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: "min(310px, 82vw)", zIndex: 40, background: "var(--fw-surface)", border: "1px solid var(--fw-line)", borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,.14)", padding: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
          <button onClick={locate} disabled={busy}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", font: "inherit", fontSize: 13, fontWeight: 700, color: "var(--fw-teal-dark)", background: "transparent", border: "none", borderRadius: 10, padding: "9px 10px", cursor: busy ? "wait" : "pointer" }}>
            <LocateFixed size={16} /> {busy ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}
          </button>
          {err && <p className="fw-field-err" role="alert" style={{ margin: "0 10px 4px" }}>{err}</p>}
          {addresses.length === 0 && <p className="fw-muted" style={{ margin: 0, padding: "8px 8px 4px", fontSize: 12.5 }}>Aún no tienes direcciones guardadas.</p>}
          {addresses.map((a) => {
            const on = a.id === current?.id;
            return (
              <button key={a.id} role="option" aria-selected={on} onClick={() => { onSelect?.(a.id); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", width: "100%", font: "inherit", color: "var(--fw-ink)", background: on ? "var(--fw-teal-soft, #e6f4f3)" : "transparent", border: "none", borderRadius: 10, padding: "9px 10px", cursor: "pointer" }}>
                <MapPin size={16} style={{ flexShrink: 0, color: "var(--fw-teal-dark)" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <strong>{a.label}</strong>{a.gps && <small className="fw-muted"> · GPS en vivo</small>}<br />
                  <span className="fw-muted" style={{ fontSize: 12 }}>{addrLine(a)}{a.ref ? ` · ${a.ref}` : ""}</span>
                </span>
                {on && <Check size={16} style={{ flexShrink: 0, color: "var(--fw-teal-dark)" }} />}
              </button>
            );
          })}
          <button onClick={manage}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", font: "inherit", fontSize: 13, fontWeight: 700, color: "var(--fw-teal-dark)", background: "transparent", border: "none", borderTop: addresses.length ? "1px solid var(--fw-line)" : "none", borderRadius: 0, padding: "10px 10px 6px", cursor: "pointer" }}>
            <Plus size={16} /> {addresses.length ? "Agregar o administrar direcciones" : "Agregar dirección"}
          </button>
        </div>
      )}
    </div>
  );
}
