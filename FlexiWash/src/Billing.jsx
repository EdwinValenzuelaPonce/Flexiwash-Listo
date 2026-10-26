import React, { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { breakdown, emptyFiscal, fiscalErrors, issueInvoice, REGIMENES, USOS_CFDI } from "./invoicing.js";
import { saveInvoice } from "./store.js";

// Facturación del cliente (empresas o personas): datos fiscales + una sola factura por los servicios que elija.
const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = (n) => fmt.format(n);
const dateTxt = (ts) => new Date(ts).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

export default function Billing({ TopBar, onBack, fiscal, setFiscal, orders, invoices, clientTag }) {
  const mine = invoices.filter((i) => i.clientTag === clientTag).sort((a, b) => b.ts - a.ts);
  const invoiced = useMemo(() => new Set(mine.flatMap((i) => i.orderIds)), [mine]);
  // Se pueden facturar servicios ya realizados y pagados en la app (el efectivo lo cobra el prestador, no FlexiWash)
  const eligible = orders.filter((o) => o.payMethod && o.payMethod !== "efectivo" && !invoiced.has(o.id));
  const [f, setF] = useState(fiscal || emptyFiscal);
  const [errs, setErrs] = useState({});
  const [saved, setSaved] = useState(!!fiscal);
  const [pick, setPick] = useState(() => new Set(eligible.filter((o) => o.wantsInvoice).map((o) => o.id)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setSaved(false); };
  const chosen = eligible.filter((o) => pick.has(o.id));
  const bd = breakdown(chosen.reduce((s, o) => s + o.total, 0));

  const saveFiscal = () => {
    const e = fiscalErrors(f); setErrs(e);
    if (Object.keys(e).length) return;
    setFiscal({ ...f, rfc: f.rfc.trim().toUpperCase(), razon: f.razon.trim(), email: f.email.trim() }); setSaved(true);
  };
  const generate = async () => {
    if (!saved || !chosen.length) return;
    setBusy(true);
    const r = await issueInvoice({ fiscal, orders: chosen });
    const id = Date.now();
    saveInvoice({ id, folio: `FW-${String(id).slice(-6)}`, clientTag, fiscal, orderIds: chosen.map((o) => o.id), items: chosen.map((o) => ({ id: o.id, label: o.lines?.map((l) => l.name).join(", ") || "Servicio", total: o.total })), ...r, ts: id });
    setPick(new Set()); setBusy(false); setMsg("Factura generada. FlexiWash la emite por el total y después liquida a los prestadores.");
  };
  const err = (k) => errs[k] && <p className="fw-field-err" role="alert">{errs[k]}</p>;

  return (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="Facturación" onBack={onBack} />
      <p className="fw-muted">FlexiWash emite una sola factura (CFDI) por el total de los servicios que elijas, con IVA desglosado. Los precios de la app ya incluyen IVA.</p>
      <h3 className="fw-section-title">Datos fiscales</h3>
      <div className="fw-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input className="fw-input" placeholder="Razón social o nombre" value={f.razon} onChange={(e) => set("razon", e.target.value)} />{err("razon")}
        <input className="fw-input" placeholder="RFC" maxLength={13} autoCapitalize="characters" value={f.rfc} onChange={(e) => set("rfc", e.target.value.toUpperCase())} />{err("rfc")}
        <select className="fw-input" aria-label="Régimen fiscal" value={f.regimen} onChange={(e) => set("regimen", e.target.value)}>{REGIMENES.map(([c, t]) => <option key={c} value={c}>{c} · {t}</option>)}</select>
        <select className="fw-input" aria-label="Uso de CFDI" value={f.uso} onChange={(e) => set("uso", e.target.value)}>{USOS_CFDI.map(([c, t]) => <option key={c} value={c}>{c} · {t}</option>)}</select>
        <input className="fw-input" placeholder="Código postal fiscal" inputMode="numeric" maxLength={5} value={f.cp} onChange={(e) => set("cp", e.target.value.replace(/\D/g, ""))} />{err("cp")}
        <input className="fw-input" placeholder="Correo para enviar la factura" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} />{err("email")}
        <button className="fw-btn-outline fw-btn-block" onClick={saveFiscal}>{saved ? "Datos guardados ✓" : "Guardar datos fiscales"}</button>
      </div>

      <h3 className="fw-section-title">Solicitar factura</h3>
      {eligible.length === 0 ? <div className="fw-card">No tienes servicios pendientes de facturar. Solo se facturan servicios pagados en la app (tarjeta, PayPal o monedero).</div> : (
        <div className="fw-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {eligible.map((o) => (
            <label key={o.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
              <input type="checkbox" checked={pick.has(o.id)} onChange={() => setPick((p) => { const n = new Set(p); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })} />
              <span style={{ flex: 1 }}>#{o.id} · {o.lines?.map((l) => l.name).join(", ") || "Servicio"}<br /><small className="fw-muted">{dateTxt(o.createdAt)}</small></span>
              <strong>{money(o.total)}</strong>
            </label>
          ))}
          <div className="fw-order-line"><span>Subtotal</span><span>{money(bd.subtotal)}</span></div>
          <div className="fw-order-line"><span>IVA 16%</span><span>{money(bd.iva)}</span></div>
          <div className="fw-order-line fw-summary-total"><span>Total</span><span>{money(bd.total)}</span></div>
          {!saved && <p className="fw-field-err" role="alert">Guarda tus datos fiscales para poder facturar.</p>}
          <button className="fw-btn-primary fw-btn-block" disabled={!saved || !chosen.length || busy} onClick={generate}><FileText size={16} /> {busy ? "Generando…" : "Generar factura única"}</button>
        </div>
      )}
      {msg && <p className="fw-muted" role="status">{msg}</p>}

      <h3 className="fw-section-title">Mis facturas</h3>
      {mine.length === 0 ? <div className="fw-card">Aún no has generado facturas.</div> : mine.map((i) => (
        <div key={i.id} className="fw-card">
          <div className="fw-order-line"><strong>{i.folio}</strong><strong>{money(i.total)}</strong></div>
          <small className="fw-muted">{dateTxt(i.ts)} · {i.fiscal.rfc} · {i.status}</small>
          {i.items.map((it) => <div key={it.id} className="fw-order-line"><span>#{it.id} · {it.label}</span><span>{money(it.total)}</span></div>)}
          <div className="fw-order-line"><span>Subtotal</span><span>{money(i.subtotal)}</span></div>
          <div className="fw-order-line"><span>IVA 16%</span><span>{money(i.iva)}</span></div>
          <small className="fw-muted" style={{ wordBreak: "break-all" }}>UUID (demo): {i.uuid}</small>
        </div>
      ))}
      <p className="fw-muted" style={{ fontSize: 11 }}>Demo: esta factura no tiene validez fiscal. En producción se timbra con un PAC.</p>
    </div>
  );
}
