import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
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
