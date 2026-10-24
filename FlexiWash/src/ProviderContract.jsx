import React, { useRef, useState } from "react";
import { FileText } from "lucide-react";

// Contrato de prestación de servicios independiente para prestadores de FlexiWash.
// BORRADOR: debe revisarlo un abogado antes de usarse en producción. Los valores entre
// constantes (plazo de remisión, comisión) se ajustan aquí.
export const CONTRACT_VERSION = "1.0";
const COMMISSION_PCT = 15;   // debe coincidir con COMMISSION en Provider.jsx
const REMIT_DAYS = 7;        // plazo para remitir la comisión de servicios cobrados en efectivo

export const CLAUSES = [
  ["Objeto y naturaleza", "FlexiWash es una plataforma que conecta clientes con prestadores de servicios de limpieza (autos, hogar y muebles). El prestador actúa como profesional independiente: no existe relación laboral, de subordinación ni de exclusividad con FlexiWash. El prestador decide su agenda, zona y servicios, dentro de la disponibilidad que publique en la app."],
  ["Veracidad de datos e identidad", "El prestador declara que los datos, documentos y fotografías que entrega (nombre, CURP, INE, selfie, teléfono) son verdaderos y suyos, y autoriza su verificación. Entregar información falsa, usar documentos ajenos o abrir cuentas duplicadas es causa de baja definitiva. La cuenta es personal e intransferible."],
  ["Estándares del servicio", "El prestador se obliga a llegar en el horario acordado, tratar con respeto al cliente, realizar el servicio descrito en la solicitud, usar productos y herramientas adecuados y mantener actualizado su estado en la app (aceptado, en camino, en proceso, finalizado). Debe avisar con anticipación si no puede cumplir una solicitud aceptada."],
  ["Seguridad y conducta", "Queda prohibido: presentarse bajo los efectos de alcohol o drogas, portar armas, ingresar a áreas del domicilio ajenas al servicio, tomar fotos o videos distintos a los del servicio, sustraer o dañar bienes, y cualquier forma de acoso o discriminación. El prestador debe seguir las indicaciones de seguridad del cliente y de FlexiWash."],
  ["Precio, comisión y pagos", `El precio del servicio es el mostrado en la solicitud. FlexiWash retiene una comisión del ${COMMISSION_PCT}% sobre el precio del servicio. En pagos con tarjeta, PayPal o monedero, FlexiWash abona al prestador el neto en su saldo, disponible para retiro conforme a las reglas de la app.`],
  ["Pagos en efectivo", `Cuando el cliente paga en efectivo, el prestador recibe el total y se obliga a cubrir a FlexiWash la comisión correspondiente a más tardar en ${REMIT_DAYS} días naturales. FlexiWash podrá compensar ese adeudo contra saldos a favor y retiros pendientes del prestador, y suspender su cuenta mientras exista un adeudo vencido. El prestador no debe pedir al cliente pagos fuera de la app por servicios ya solicitados en ella.`],
  ["Calificaciones, comentarios e insignias", "El prestador acepta que su perfil muestre sus calificaciones, los comentarios de clientes, sus insignias y el historial de servicios realizados. Las insignias se otorgan automáticamente según las calificaciones recibidas y pueden retirarse si cambian. No está permitido pedir, comprar ni manipular calificaciones."],
  ["Fotografías del servicio", "El prestador sube fotografías del servicio como evidencia del trabajo y autoriza que se muestren al cliente y en su historial público de servicios. No deben aparecer rostros, documentos, placas legibles ni datos personales del cliente; si aparecen, FlexiWash puede retirarlas."],
  ["Daños y responsabilidad", "El prestador es responsable de los daños que cause por negligencia o dolo durante el servicio. El cliente debe reportar cualquier incidente por el chat de asistencia dentro del plazo que FlexiWash indique, y el prestador se obliga a colaborar en la aclaración. FlexiWash facilita la mediación pero no asume responsabilidad por actos u omisiones del prestador, salvo lo que la ley disponga."],
  ["Facturación e impuestos", "El prestador es responsable de sus obligaciones fiscales y de seguridad social derivadas de los ingresos que obtenga. FlexiWash emitirá comprobante únicamente de su comisión. La facturación del servicio a clientes empresa se sujetará a lo que FlexiWash informe en la app al momento de la solicitud."],
  ["Suspensión y terminación", "FlexiWash puede suspender o dar de baja la cuenta por incumplir este contrato, por quejas graves o reiteradas, por calificaciones consistentemente bajas o por resultados negativos de la verificación. El prestador puede darse de baja en cualquier momento, tras concluir los servicios que tenga aceptados y liquidar cualquier adeudo."],
  ["Privacidad y datos personales", "FlexiWash tratará los datos del prestador conforme a su aviso de privacidad y a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, para verificar su identidad, operar la plataforma, prevenir fraudes y mejorar el servicio. Los documentos de identidad no se muestran a los clientes."],
  ["Modificaciones y jurisdicción", "FlexiWash puede actualizar este contrato notificándolo en la app; el uso continuado tras la notificación implica aceptación, y el prestador puede darse de baja si no está de acuerdo. Para su interpretación y cumplimiento, las partes se someten a las leyes aplicables y a los tribunales de Culiacán, Sinaloa."],
];

export const contractText = (name) =>
  `CONTRATO DE PRESTACIÓN DE SERVICIOS INDEPENDIENTES — FlexiWash v${CONTRACT_VERSION}\nPrestador: ${name}\n\n` +
  CLAUSES.map(([t, x], i) => `${i + 1}. ${t}\n${x}`).join("\n\n");

// Paso del registro: el prestador lee (hasta el final), acepta y firma escribiendo su nombre completo.
export default function ProviderContract({ name, accepted, setAccepted, signature, setSignature, errs = {} }) {
  const [read, setRead] = useState(false);
  const box = useRef(null);
  const onScroll = () => { const el = box.current; if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setRead(true); };
  return (
    <>
      <style>{`.fwk-box{max-height:320px;overflow-y:auto;border:1px solid var(--fw-line);border-radius:12px;padding:12px 14px;background:#fff;font-size:12.5px;line-height:1.5}.fwk-box h4{margin:10px 0 2px;font-size:13px}.fwk-box h4:first-child{margin-top:0}.fwk-box p{margin:0;color:var(--fw-ink-soft)}.fwk-hint{font-size:12px;color:var(--fw-ink-soft);display:flex;gap:6px;align-items:center}`}</style>
      <p className="fw-muted">Lee el contrato completo. Al firmar aceptas sus cláusulas (versión {CONTRACT_VERSION}).</p>
      <div className="fwk-box" ref={box} onScroll={onScroll} tabIndex={0} aria-label="Contrato de prestación de servicios">
        {CLAUSES.map(([t, x], i) => <React.Fragment key={t}><h4>{i + 1}. {t}</h4><p>{x}</p></React.Fragment>)}
      </div>
      {!read && <p className="fwk-hint"><FileText size={14} /> Desplázate hasta el final para poder aceptar.</p>}
      <label style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "flex-start", opacity: read ? 1 : 0.5 }}>
        <input type="checkbox" disabled={!read} checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>He leído y acepto las cláusulas del contrato de prestación de servicios.</span>
      </label>
      {errs.accepted && <p className="fw-field-err" role="alert">{errs.accepted}</p>}
      <input className="fw-input" placeholder="Firma: escribe tu nombre completo" value={signature} onChange={(e) => setSignature(e.target.value)} />
      {errs.signature && <p className="fw-field-err" role="alert">{errs.signature}</p>}
      {signature && name && <p className="fw-muted" style={{ fontSize: 11 }}>Firma electrónica simple: se guarda tu nombre, la versión del contrato y la fecha y hora de aceptación.</p>}
    </>
  );
}
