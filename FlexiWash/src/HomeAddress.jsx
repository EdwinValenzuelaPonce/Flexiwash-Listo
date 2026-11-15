import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, MapPin, LocateFixed } from "lucide-react";
import { addrLine } from "./geocode.js";

// Ubicación de la esquina superior izquierda del Inicio. Al tocarla se despliega y muestra la dirección de la
// ubicación actual del cliente (la única con la que se piden los servicios). Desde ahí se puede obtener o actualizar.
// Props: address { street, colonia, cp, lat, lng, gps } | null · onLocate(): Promise<{ ok, error? }>
export default function HomeAddress({ address = null, onLocate }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef(null);

  // Se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  const locate = async () => {
    setBusy(true); setErr("");
    const r = await onLocate();
    setBusy(false);
    if (!r?.ok) setErr(r?.error || "No pudimos obtener tu ubicación.");
  };

  const coords = address?.lat != null ? `${Number(address.lat).toFixed(5)}, ${Number(address.lng).toFixed(5)}` : "";
  const named = address && address.street && address.street !== "Mi ubicación actual";
  const line = named ? addrLine(address) : coords ? `Ubicación por GPS (${coords})` : "";

  return (
    <div ref={box} style={{ position: "relative", minWidth: 0, maxWidth: "62%" }}>
      <button className="fw-addr" aria-haspopup="true" aria-expanded={open} onClick={() => { setErr(""); setOpen((v) => !v); }} style={{ maxWidth: "100%" }}>
        <MapPin size={15} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address ? "Ubicación actual" : "Obtener mi ubicación"}</span>
        <ChevronLeft size={14} className="fw-rot" style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : undefined, transition: "transform .15s" }} />
      </button>

      {open && (
        <div role="region" aria-label="Mi ubicación" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: "min(310px, 82vw)", zIndex: 40, background: "var(--fw-surface)", border: "1px solid var(--fw-line)", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.14)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {address ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--fw-ink)" }}>
              <MapPin size={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--fw-teal-dark)" }} />
              <span style={{ minWidth: 0 }}><strong>Ubicación actual</strong><br /><span className="fw-muted" style={{ fontSize: 12.5 }}>{line}</span></span>
            </div>
          ) : (
            <p className="fw-muted" style={{ margin: 0, fontSize: 12.5 }}>Aún no has obtenido tu ubicación. Tus servicios se solicitan a tu ubicación actual.</p>
          )}
          <button onClick={locate} disabled={busy}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", font: "inherit", fontSize: 13, fontWeight: 700, color: "var(--fw-teal-dark)", background: "transparent", border: "1px solid var(--fw-line)", borderRadius: 10, padding: "10px", cursor: busy ? "wait" : "pointer" }}>
            <LocateFixed size={16} /> {busy ? "Obteniendo ubicación…" : address ? "Actualizar mi ubicación" : "Usar mi ubicación actual"}
          </button>
          {err && <p className="fw-field-err" role="alert" style={{ margin: 0 }}>{err}</p>}
          {address && <p className="fw-muted" style={{ margin: 0, fontSize: 11.5 }}>Tu prestador llegará a esta ubicación.</p>}
        </div>
      )}
    </div>
  );
}
