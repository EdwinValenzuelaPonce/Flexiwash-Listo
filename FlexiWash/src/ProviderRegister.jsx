import React, { useRef, useState } from "react";
import { registerProvider } from "./store.js";
import { validPhone, onlyDigits, validCurp } from "./validators.js";
import { verifyIdentity, validClaveElector, validVigencia } from "./identity.js";
import { compressImage } from "./photos.js";
import ProviderContract, { CONTRACT_VERSION } from "./ProviderContract.jsx";
import { ShieldCheck, Camera, Check, X as XIcon } from "lucide-react";

// Registro verificado de prestadores en cuatro pasos:
//   1) datos personales + CURP + PIN
//   2) identidad: INE (frente y reverso), selfie con INE, clave de elector y vigencia  → validación (identity.js)
//   3) contrato de prestación de servicios (se lee, se acepta y se firma)
//   4) código de verificación por SMS al teléfono
// DEMO: no se envía SMS real (el código se muestra en pantalla) y las fotos del INE NO se guardan: solo se registra que se
// entregaron. En producción: SMS real, fotos en un bucket privado y validación con un proveedor KYC o consulta oficial.
const SERVICES = [["autos", "Autos"], ["hogar", "Hogar"], ["muebles", "Muebles"]];
const DOCS = [["front", "INE · frente"], ["back", "INE · reverso"], ["selfie", "Selfie con tu INE"]];
const newCode = () => String(Math.floor(1000 + Math.random() * 9000));
const fmtPhone = (v) => { const d = onlyDigits(v).slice(0, 10); return d.length > 6 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d; };
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

function DocPicker({ label, value, onPick, selfie }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true);
    try { onPick(await compressImage(file)); } catch { onPick(null); } finally { setBusy(false); }
  };
  return (
    <button type="button" className={`fwr-doc ${value ? "has" : ""}`} onClick={() => ref.current?.click()} disabled={busy}>
      <input ref={ref} type="file" accept="image/*" capture={selfie ? "user" : "environment"} hidden onChange={pick} aria-label={label} />
      {value ? <img src={value} alt={label} /> : <Camera size={22} />}
      <span>{busy ? "Procesando…" : value ? `${label} ✓` : label}</span>
    </button>
  );
}

export default function ProviderRegister({ TopBar, providers, onBack, onDone }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ nombre: "", telefono: "", curp: "", zona: "Culiacán", pin: "", services: ["autos"], terms: false, claveElector: "", vigencia: "" });
  const [docs, setDocs] = useState({ front: null, back: null, selfie: null });
  const [idResult, setIdResult] = useState(null);
  const [idBusy, setIdBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState("");
  const [errs, setErrs] = useState({});
  const [code, setCode] = useState(newCode);
  const [typed, setTyped] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const back = () => { setErrs({}); setStep((s) => s - 1); };

  const validate1 = () => {
    const e = {};
    if (f.nombre.trim().length < 5 || !f.nombre.trim().includes(" ")) e.nombre = "Escribe tu nombre completo.";
    if (!validPhone(f.telefono)) e.telefono = "Teléfono de 10 dígitos.";
    else if (providers.some((p) => onlyDigits(p.telefono) === onlyDigits(f.telefono))) e.telefono = "Ese teléfono ya está registrado.";
    if (!validCurp(f.curp)) e.curp = "CURP inválida (18 caracteres).";
    else if (providers.some((p) => p.curp === f.curp.trim().toUpperCase())) e.curp = "Esa CURP ya está registrada.";
    if (f.zona.trim().length < 3) e.zona = "Indica tu zona de trabajo.";
    if (!/^\d{4,6}$/.test(f.pin)) e.pin = "PIN de 4 a 6 dígitos.";
    if (f.services.length === 0) e.services = "Elige al menos un servicio.";
    if (!f.terms) e.terms = "Debes aceptar la verificación de identidad.";
    return e;
  };
  const next1 = () => { const e = validate1(); setErrs(e); if (!Object.keys(e).length) setStep(2); };

  const next2 = async () => {
    const e = {};
    if (!validClaveElector(f.claveElector)) e.claveElector = "Clave de elector: 18 caracteres (6 letras, 8 dígitos, H/M y 3 dígitos).";
    if (!validVigencia(f.vigencia)) e.vigencia = "Indica el año de vigencia de tu INE (no vencida).";
    DOCS.forEach(([k, l]) => { if (!docs[k]) e[k] = `Falta: ${l}.`; });
    setErrs(e);
    if (Object.keys(e).length) return;
    setIdBusy(true);
    const res = await verifyIdentity({ curp: f.curp, claveElector: f.claveElector, vigencia: f.vigencia, docs });
    setIdBusy(false); setIdResult(res);
    if (res.status === "verified") setStep(3);
  };

  const next3 = () => {
    const e = {};
    if (!accepted) e.accepted = "Debes aceptar el contrato para continuar.";
    if (norm(signature) !== norm(f.nombre)) e.signature = "La firma debe coincidir con tu nombre completo.";
    setErrs(e);
    if (!Object.keys(e).length) { setCode(newCode()); setTyped(""); setCodeErr(""); setStep(4); }
  };

  const confirm = () => {
    if (typed !== code) return setCodeErr("Código incorrecto.");
    const id = registerProvider({
      nombre: f.nombre.trim(), telefono: onlyDigits(f.telefono), curp: f.curp.trim().toUpperCase(), zona: f.zona.trim(), pin: f.pin, services: f.services,
      // Identidad: solo se guardan resultados y los últimos 4 de la clave de elector (nunca las fotos ni la clave completa).
      idStatus: idResult.status, idChecks: idResult.checks.map(({ id: cid, ok }) => ({ id: cid, ok })), idVerifiedAt: Date.now(),
      ineLast4: f.claveElector.trim().slice(-4), idDocs: { front: true, back: true, selfie: true },
      // Contrato: versión, firma y fecha.
      contract: { version: CONTRACT_VERSION, signature: signature.trim(), acceptedAt: Date.now() },
    });
    onDone(id);
  };
  const err = (k) => errs[k] && <p className="fw-field-err" role="alert">{errs[k]}</p>;
  const titles = ["Datos personales", "Identidad", "Contrato", "Código SMS"];

  return (
    <div className="fw-screen">
      <style>{`.fwr-chips{display:flex;gap:6px;flex-wrap:wrap}.fwr-chip{border:1px solid var(--fw-line);background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;color:var(--fw-ink-soft);cursor:pointer}.fwr-chip.is-on{background:var(--fw-teal);border-color:var(--fw-teal);color:#fff}.fwr-form{display:flex;flex-direction:column;gap:12px;padding:6px 2px 24px}.fwr-demo{background:#FFF7E0;border:1px dashed #E0B83A;border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.5;text-align:center}.fwr-demo strong{font-size:20px;letter-spacing:4px;display:block}.fwr-docs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fwr-doc{border:1px dashed var(--fw-line);background:#fff;border-radius:12px;min-height:104px;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:inherit;font-size:11px;font-weight:700;color:var(--fw-ink-soft);cursor:pointer;overflow:hidden}.fwr-doc.has{border-style:solid;border-color:var(--fw-teal)}.fwr-doc img{width:100%;height:64px;object-fit:cover;border-radius:8px}.fwr-checks{background:#fff;border:1px solid var(--fw-line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;font-size:12.5px}.fwr-checks div{display:flex;gap:6px;align-items:center}.fwr-ok{color:#1c8a4a}.fwr-no{color:#c0392b}`}</style>
      <TopBar title="Registro de prestador" onBack={step === 1 ? onBack : back} />
      <div className="fwr-form">
        <p className="fw-muted">Paso {step} de 4 · {titles[step - 1]}</p>
        {step === 1 && (<>
          <input className="fw-input" placeholder="Nombre completo" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />{err("nombre")}
          <input className="fw-input" placeholder="Teléfono (10 dígitos)" inputMode="numeric" value={f.telefono} onChange={(e) => set("telefono", fmtPhone(e.target.value))} />{err("telefono")}
          <input className="fw-input" placeholder="CURP" maxLength={18} autoCapitalize="characters" value={f.curp} onChange={(e) => set("curp", e.target.value.toUpperCase())} />{err("curp")}
          <input className="fw-input" placeholder="Zona de trabajo" value={f.zona} onChange={(e) => set("zona", e.target.value)} />{err("zona")}
          <input className="fw-input" placeholder="Crea un PIN (4 a 6 dígitos)" type="password" inputMode="numeric" maxLength={6} value={f.pin} onChange={(e) => set("pin", onlyDigits(e.target.value))} />{err("pin")}
          <span className="fwp-label">Servicios que ofreces</span>
          <div className="fwr-chips">{SERVICES.map(([id, l]) => (
            <button key={id} type="button" className={`fwr-chip ${f.services.includes(id) ? "is-on" : ""}`} onClick={() => set("services", f.services.includes(id) ? f.services.filter((x) => x !== id) : [...f.services, id])}>{l}</button>
          ))}</div>{err("services")}
          <label style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "flex-start" }}>
            <input type="checkbox" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} />
            <span>Acepto la verificación de identidad y antecedentes, y el aviso de privacidad.</span>
          </label>{err("terms")}
          <button className="fw-btn-primary fw-btn-block" onClick={next1}>Continuar</button>
        </>)}
        {step === 2 && (<>
          <p className="fw-muted">Valida tu identidad con tu INE vigente. Las fotos solo se usan para la verificación y no se muestran a los clientes.</p>
          <div className="fwr-docs">{DOCS.map(([k, l]) => <DocPicker key={k} label={l} selfie={k === "selfie"} value={docs[k]} onPick={(d) => { setDocs((p) => ({ ...p, [k]: d })); setIdResult(null); }} />)}</div>
          {DOCS.map(([k]) => <React.Fragment key={k}>{err(k)}</React.Fragment>)}
          <input className="fw-input" placeholder="Clave de elector (18 caracteres)" maxLength={18} autoCapitalize="characters" value={f.claveElector} onChange={(e) => { set("claveElector", e.target.value.toUpperCase()); setIdResult(null); }} />{err("claveElector")}
          <input className="fw-input" placeholder="Vigencia del INE (año, ej. 2030)" inputMode="numeric" maxLength={4} value={f.vigencia} onChange={(e) => { set("vigencia", onlyDigits(e.target.value)); setIdResult(null); }} />{err("vigencia")}
          {idResult && idResult.status !== "verified" && (
            <div className="fwr-checks" role="alert">
              <strong>No pudimos validar tu identidad:</strong>
              {idResult.checks.map((c) => <div key={c.id} className={c.ok ? "fwr-ok" : "fwr-no"}>{c.ok ? <Check size={14} /> : <XIcon size={14} />} {c.label}</div>)}
            </div>
          )}
          <button className="fw-btn-primary fw-btn-block" disabled={idBusy} onClick={next2}><ShieldCheck size={18} /> {idBusy ? "Validando…" : "Validar identidad"}</button>
        </>)}
        {step === 3 && (<>
          <ProviderContract name={f.nombre} accepted={accepted} setAccepted={setAccepted} signature={signature} setSignature={setSignature} errs={errs} />
          <button className="fw-btn-primary fw-btn-block" onClick={next3}>Firmar y continuar</button>
        </>)}
        {step === 4 && (<>
          <p className="fw-muted">Te enviamos un código al {f.telefono}.</p>
          <div className="fwr-demo">Demo: no se envía SMS real. Tu código es<strong>{code}</strong></div>
          <input className="fw-input" placeholder="Código de 4 dígitos" inputMode="numeric" maxLength={4} value={typed} onChange={(e) => { setTyped(onlyDigits(e.target.value)); setCodeErr(""); }} />
          {codeErr && <p className="fw-field-err" role="alert">{codeErr}</p>}
          <button className="fw-btn-primary fw-btn-block" disabled={typed.length !== 4} onClick={confirm}><ShieldCheck size={18} /> Verificar y crear cuenta</button>
          <button className="fw-btn-outline fw-btn-block" onClick={() => { setCode(newCode()); setTyped(""); setCodeErr(""); }}>Reenviar código</button>
        </>)}
      </div>
    </div>
  );
}
