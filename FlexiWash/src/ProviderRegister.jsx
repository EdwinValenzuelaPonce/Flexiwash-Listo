import React, { useState } from "react";
import { registerProvider } from "./store.js";
import { validPhone, onlyDigits, validCurp } from "./validators.js";
import { ShieldCheck } from "lucide-react";

// Registro verificado de prestadores en dos pasos:
//   1) datos personales + CURP (formato) + PIN
//   2) código de verificación por SMS al teléfono
// DEMO: no se envía SMS real; el código se muestra en pantalla. En producción, cambiar `sendCode`
// por un proveedor de SMS (Twilio, etc.) y validar la CURP/INE contra un servicio de identidad.
const SERVICES = [["autos", "Autos"], ["hogar", "Hogar"], ["muebles", "Muebles"]];
const newCode = () => String(Math.floor(1000 + Math.random() * 9000));
const fmtPhone = (v) => { const d = onlyDigits(v).slice(0, 10); return d.length > 6 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d; };

export default function ProviderRegister({ TopBar, providers, onBack, onDone }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ nombre: "", telefono: "", curp: "", zona: "Culiacán", pin: "", services: ["autos"], terms: false });
  const [errs, setErrs] = useState({});
  const [code, setCode] = useState(newCode);
  const [typed, setTyped] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (f.nombre.trim().length < 5 || !f.nombre.trim().includes(" ")) e.nombre = "Escribe tu nombre completo.";
    if (!validPhone(f.telefono)) e.telefono = "Teléfono de 10 dígitos.";
    else if (providers.some((p) => onlyDigits(p.telefono) === onlyDigits(f.telefono))) e.telefono = "Ese teléfono ya está registrado.";
    if (!validCurp(f.curp)) e.curp = "CURP inválida (18 caracteres).";
    if (f.zona.trim().length < 3) e.zona = "Indica tu zona de trabajo.";
    if (!/^\d{4,6}$/.test(f.pin)) e.pin = "PIN de 4 a 6 dígitos.";
    if (f.services.length === 0) e.services = "Elige al menos un servicio.";
    if (!f.terms) e.terms = "Debes aceptar la verificación de identidad.";
    return e;
  };
  const next = () => { const e = validate(); setErrs(e); if (Object.keys(e).length === 0) { setCode(newCode()); setTyped(""); setCodeErr(""); setStep(2); } };
  const confirm = () => {
    if (typed !== code) return setCodeErr("Código incorrecto.");
    const id = registerProvider({ nombre: f.nombre.trim(), telefono: onlyDigits(f.telefono), curp: f.curp.trim().toUpperCase(), zona: f.zona.trim(), pin: f.pin, services: f.services });
    onDone(id);
  };
  const err = (k) => errs[k] && <p className="fw-field-err" role="alert">{errs[k]}</p>;

  return (
    <div className="fw-screen">
      <style>{`.fwr-chips{display:flex;gap:6px;flex-wrap:wrap}.fwr-chip{border:1px solid var(--fw-line);background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;color:var(--fw-ink-soft);cursor:pointer}.fwr-chip.is-on{background:var(--fw-teal);border-color:var(--fw-teal);color:#fff}.fwr-form{display:flex;flex-direction:column;gap:12px;padding:6px 2px 24px}.fwr-demo{background:#FFF7E0;border:1px dashed #E0B83A;border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.5;text-align:center}.fwr-demo strong{font-size:20px;letter-spacing:4px;display:block}`}</style>
      <TopBar title="Registro de prestador" onBack={step === 1 ? onBack : () => setStep(1)} />
      {step === 1 ? (
        <div className="fwr-form">
          <p className="fw-muted">Paso 1 de 2 · Verificamos tu identidad antes de que recibas solicitudes.</p>
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
          <button className="fw-btn-primary fw-btn-block" onClick={next}>Continuar</button>
        </div>
      ) : (
        <div className="fwr-form">
          <p className="fw-muted">Paso 2 de 2 · Te enviamos un código al {f.telefono}.</p>
          <div className="fwr-demo">Demo: no se envía SMS real. Tu código es<strong>{code}</strong></div>
          <input className="fw-input" placeholder="Código de 4 dígitos" inputMode="numeric" maxLength={4} value={typed} onChange={(e) => { setTyped(onlyDigits(e.target.value)); setCodeErr(""); }} />
          {codeErr && <p className="fw-field-err" role="alert">{codeErr}</p>}
          <button className="fw-btn-primary fw-btn-block" disabled={typed.length !== 4} onClick={confirm}><ShieldCheck size={18} /> Verificar y crear cuenta</button>
          <button className="fw-btn-outline fw-btn-block" onClick={() => { setCode(newCode()); setTyped(""); setCodeErr(""); }}>Reenviar código</button>
        </div>
      )}
    </div>
  );
}
