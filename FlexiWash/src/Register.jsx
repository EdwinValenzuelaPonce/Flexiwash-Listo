import React, { useState } from "react";
import { onlyDigits, validPhone, validateAddress } from "./validators.js";

// Registro del cliente/usuario: nombre y teléfono obligatorios; la dirección es OPCIONAL
// (si el cliente no la captura aquí, puede agregarla después desde Inicio o al contratar un servicio).
// Props:
//  - TopBar: componente de barra superior de App.jsx
//  - initialPhone / initialEmail: datos que ya escribió al iniciar sesión (para no pedirlos otra vez)
//  - onDone({ nombre, telefono, email, address | null }): se llama cuando los datos son válidos
//  - onBack: regresar a la pantalla anterior
const ADDR_KEYS = ["calle", "numero", "colonia", "cp", "ref"];

export default function Register({ TopBar, initialPhone = "", initialEmail = "", onDone, onBack }) {
  const [f, setF] = useState({ nombre: "", telefono: onlyDigits(initialPhone).slice(0, 10), calle: "", numero: "", colonia: "", cp: "", ref: "" });
  const [err, setErr] = useState({});
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErr((p) => ({ ...p, [k]: undefined })); };

  const submit = () => {
    const e = {};
    if (f.nombre.trim().length < 3 || !/^[\p{L}\s.'-]+$/u.test(f.nombre.trim())) e.nombre = "Escribe tu nombre completo.";
    if (!validPhone(f.telefono)) e.telefono = "Ingresa un número de 10 dígitos.";

    // La dirección es opcional: solo se valida si el cliente empezó a llenarla.
    const wantsAddress = ["calle", "numero", "colonia", "cp"].some((k) => f[k].trim());
    let address = null;
    if (wantsAddress) {
      const street = `${f.calle} ${f.numero}`.trim();
      const a = validateAddress({ label: "Casa", street, colonia: f.colonia, cp: f.cp });
      if (a.street) e.calle = !f.calle.trim() ? "Escribe la calle." : !f.numero.trim() ? "Falta el número exterior." : a.street;
      if (a.colonia) e.colonia = a.colonia;
      if (a.cp) e.cp = a.cp;
      if (!Object.keys(a).length) address = { label: "Casa", street, calle: f.calle.trim(), numero: f.numero.trim(), colonia: f.colonia.trim(), cp: f.cp, ref: f.ref.trim() };
    }
    setErr(e);
    if (Object.keys(e).length) return;
    onDone({ nombre: f.nombre.trim(), telefono: f.telefono, email: initialEmail.trim(), address });
  };

  const field = (k, placeholder, props = {}) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <input className="fw-input" placeholder={placeholder} aria-label={placeholder} value={f[k]} onChange={(e) => set(k, props.digits ? onlyDigits(e.target.value) : e.target.value)} {...props.input} />
      {err[k] && <p className="fw-field-err" role="alert">{err[k]}</p>}
    </div>
  );

  return (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="" onBack={onBack} />
      <div className="fw-authform">
        <h2>Crea tu cuenta</h2>
        <p>Cuéntanos quién eres para que tu prestador sepa a quién atender.</p>

        {field("nombre", "Nombre completo", { input: { autoComplete: "name", maxLength: 60 } })}
        {field("telefono", "Teléfono (10 dígitos)", { digits: true, input: { inputMode: "numeric", autoComplete: "tel-national", maxLength: 10 } })}

        <p className="fw-section-title" style={{ margin: "8px 0 0" }}>Dirección <span className="fw-muted">(opcional)</span></p>
        <p>Puedes agregarla ahora o después, al contratar tu primer servicio.</p>
        <div className="fw-cardform-row">
          {field("calle", "Calle", { input: { maxLength: 60 } })}
          {field("numero", "No. exterior", { input: { maxLength: 10 } })}
        </div>
        <div className="fw-cardform-row">
          {field("colonia", "Colonia", { input: { maxLength: 60 } })}
          {field("cp", "C.P.", { digits: true, input: { inputMode: "numeric", maxLength: 5 } })}
        </div>
        {field("ref", "Referencias (opcional)", { input: { maxLength: 80 } })}

        <button className="fw-btn-primary fw-btn-block" onClick={submit}>Crear cuenta</button>
        <button className="fw-linklike" onClick={() => { setF((p) => ({ ...p, ...Object.fromEntries(ADDR_KEYS.map((k) => [k, ""])) })); setErr({}); }}>
          Omitir dirección por ahora
        </button>
      </div>
    </div>
  );
}
