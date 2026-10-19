import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { getSyncStatus } from './store.js';

function DebugBadge() {
  const [st, setSt] = React.useState(getSyncStatus());
  React.useEffect(() => { const t = setInterval(() => setSt(getSyncStatus()), 1000); return () => clearInterval(t); }, []);
  let host = "";
  try { host = new URL(import.meta.env.VITE_SUPABASE_URL).host; } catch { /* sin variable */ }
  const ok = st.cloud && st.online;
  const text = !st.cloud ? "SIN NUBE: la app no recibio las variables de Supabase (guarda solo en este celular)"
    : ok ? `NUBE OK (${host})` : `NUBE CON ERROR (${host}): ${st.error || "conectando..."}`;
  return <div style={{ position: "fixed", left: 6, right: 6, bottom: 6, zIndex: 99999, padding: "6px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff", background: ok ? "#2E9E5B" : "#D64545", wordBreak: "break-word" }}>{text}</div>;
}
const showDebug = new URLSearchParams(window.location.search).has("debug");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App />{showDebug && <DebugBadge />}</React.StrictMode>
);

// Teclado en el celular: la app se ajusta a la altura realmente visible y el campo enfocado se desplaza a la vista.
const vv = window.visualViewport;
const setAppHeight = () => document.documentElement.style.setProperty("--app-h", `${Math.round(vv ? vv.height : window.innerHeight)}px`);
setAppHeight();
(vv || window).addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", setAppHeight);
document.addEventListener("focusin", (e) => {
  const el = e.target;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  }
});
