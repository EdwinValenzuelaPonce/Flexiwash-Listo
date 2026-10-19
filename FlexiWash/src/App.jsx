import React, { useEffect, useMemo, useState } from "react";
import logoFlexiWash from "./assets/LogoFlexiWash.webp";
import ProviderPanel from "./Provider.jsx";
import TrackingMap, { PlaceMap } from "./TrackingMap.jsx";
import { useRequests, saveRequest, startCall, useAllMessages, useProviderCfgs, useRatings, saveRating, liveMember, usePhotos, resetDemo, useProviders, providerToMember } from "./store.js";
import ProviderRegister from "./ProviderRegister.jsx";
import { ChatView, CallView, useIncomingCall } from "./Comms.jsx";
import { usePersistentState, clearPersistedState } from "./usePersistentState.js";
import { formatCardNumber, formatExp, onlyDigits, validEmail, validPhone, validateCard, validateAddress, testCard } from "./validators.js";
import {
  ChevronLeft, Search, Bell, ShoppingCart, Plus, Minus, Star, ShieldCheck,
  FileCheck2, HeartHandshake, Camera, CreditCard, Smartphone, Mail, User,
  Home as HomeIcon, Clock, MapPin, Wallet, RefreshCw, CheckCircle2, Truck,
  Sparkles, Sofa, BedDouble, UtensilsCrossed, Bath, Wind, Droplet, Fan,
  SprayCan, Car, AlertTriangle, X, Pencil, Camera as CameraIcon, MessageCircle
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Data                                                                    */
/* ---------------------------------------------------------------------- */

const AUTO_TYPES = ["Sedán", "SUV", "Pickup", "Motocicleta"];
// El precio de cada paquete es el del Sedán (base); los demás vehículos lo multiplican y se redondea a $5.
const AUTO_TYPE_FACTOR = { "Sedán": 1, SUV: 1.25, Pickup: 1.35, Motocicleta: 0.6 };
const autoPrice = (base, tipo) => Math.round((base * (AUTO_TYPE_FACTOR[tipo] ?? 1)) / 5) * 5;

const AUTO_PACKAGES = [
  { id: "express", name: "Express", desc: "Enjuague rápido y secado a mano, 15 minutos.", price: 120, Icon: Sparkles },
  { id: "basico", name: "Básico", desc: "Lavado exterior con espuma activa y llantas.", price: 150, Icon: Droplet },
  { id: "intermedio", name: "Intermedio", desc: "Exterior e interior con aspirado completo.", price: 180, Icon: Fan },
  { id: "premium", name: "Premium", desc: "Detallado 360°: interior, exterior y encerado.", price: 220, Icon: Wind },
];

const round5 = (n) => Math.round(n / 5) * 5;

// HOGAR: el precio sale de las ÁREAS elegidas (precio base por área × factor del tipo de limpieza).
// Con el set estándar (sala, comedor, cocina, baño, recámara) da ≈ $350 / $560 / $700.
const HOGAR_AREAS = [
  { id: "sala", name: "Sala", price: 65 },
  { id: "comedor", name: "Comedor", price: 50 },
  { id: "cocina", name: "Cocina", price: 100 },
  { id: "bano", name: "Baño", price: 70 },
  { id: "recamara", name: "Recámara", price: 65 },
  { id: "patio", name: "Patio o terraza", price: 80 },
  { id: "cochera", name: "Cochera", price: 70 },
  { id: "escaleras", name: "Escaleras", price: 50 },
  { id: "lavanderia", name: "Lavandería", price: 45 },
];
const STD_AREAS = { sala: 1, comedor: 1, cocina: 1, bano: 1, recamara: 1 };
const HOGAR_CATEGORIES = [
  { id: "basica", name: "Limpieza básica", desc: "Pisos, superficies, cocina exterior, baños y recolección de basura.", factor: 1, min: 150, defAreas: STD_AREAS, Icon: HomeIcon },
  { id: "profunda", name: "Limpieza profunda", desc: "Limpieza detallada de cocina, baños, superficies y zonas seleccionadas.", factor: 1.6, min: 250, defAreas: STD_AREAS, Icon: Sparkles },
  { id: "mudanza", name: "Limpieza por mudanza", desc: "Preparación profunda de la vivienda antes de entregar u ocupar.", factor: 2, min: 350, defAreas: STD_AREAS, Icon: RefreshCw },
  { id: "area", name: "Área específica", desc: "Elige las áreas del hogar para una limpieza puntual.", factor: 1.5, min: 150, defAreas: { cocina: 1 }, Icon: Bath },
];
const areaTotal = (areas) => Object.values(areas).reduce((n, v) => n + v, 0);
// Si la solicitud no trae áreas (carrito viejo) se usan las predeterminadas del servicio.
const hogarAreas = (item, e) => (e?.areas && areaTotal(e.areas) > 0 ? e.areas : item.defAreas);
const hogarPrice = (item, areas) =>
  Math.max(item.min, round5(HOGAR_AREAS.reduce((sum, a) => sum + a.price * (areas[a.id] || 0), 0) * item.factor));
const hogarLabel = (areas) =>
  HOGAR_AREAS.filter((a) => areas[a.id] > 0).map((a) => (areas[a.id] > 1 ? `${a.name} ×${areas[a.id]}` : a.name)).join(", ");

// MUEBLES: precio = base × factor del tamaño × factor del material, redondeado a $5.
// El tamaño marcado en defSize y el primer material son la referencia (factor 1).
const MUEBLES_CATEGORIES = [
  {
    id: "sofa", name: "Sofá", desc: "Lavado profundo de tapicería y extracción de suciedad.", price: 250, Icon: Sofa, defSize: "3p",
    sizes: [{ id: "1p", name: "1 plaza", factor: 0.6 }, { id: "2p", name: "Love seat (2 plazas)", factor: 0.8 }, { id: "3p", name: "3 plazas", factor: 1 }, { id: "sec", name: "Seccional (4+ plazas)", factor: 1.6 }],
    materials: [{ id: "tela", name: "Tela", factor: 1 }, { id: "micro", name: "Microfibra", factor: 1.1 }, { id: "vinil", name: "Piel sintética", factor: 1.15 }, { id: "terc", name: "Terciopelo", factor: 1.2 }, { id: "piel", name: "Piel", factor: 1.3 }],
  },
  {
    id: "colchon", name: "Colchón", desc: "Limpieza, extracción y sanitización de colchón.", price: 250, Icon: BedDouble, defSize: "mat",
    sizes: [{ id: "ind", name: "Individual", factor: 0.75 }, { id: "mat", name: "Matrimonial", factor: 1 }, { id: "queen", name: "Queen size", factor: 1.2 }, { id: "king", name: "King size", factor: 1.4 }],
    materials: [{ id: "resortes", name: "Resortes", factor: 1 }, { id: "espuma", name: "Espuma", factor: 1 }, { id: "hibrido", name: "Híbrido", factor: 1.1 }, { id: "memory", name: "Memory foam", factor: 1.15 }, { id: "latex", name: "Látex", factor: 1.2 }],
  },
  {
    id: "silla", name: "Sillas", desc: "Limpieza de tapicería de sillas de comedor u oficina.", price: 80, Icon: UtensilsCrossed, defSize: "comedor",
    sizes: [{ id: "comedor", name: "Silla de comedor", factor: 1 }, { id: "oficina", name: "Silla de oficina", factor: 1.25 }, { id: "sillon", name: "Sillón individual", factor: 2 }],
    materials: [{ id: "tela", name: "Tela", factor: 1 }, { id: "malla", name: "Malla", factor: 0.9 }, { id: "vinil", name: "Piel sintética", factor: 1.1 }, { id: "piel", name: "Piel", factor: 1.3 }],
  },
  {
    id: "alfombra", name: "Alfombra", desc: "Lavado y extracción según tamaño y material de la alfombra.", price: 220, Icon: Sparkles, defSize: "med",
    sizes: [{ id: "chica", name: "Chica (hasta 2 m²)", factor: 0.6 }, { id: "med", name: "Mediana (2–6 m²)", factor: 1 }, { id: "grande", name: "Grande (6–12 m²)", factor: 1.6 }, { id: "xl", name: "Extra grande (+12 m²)", factor: 2.4 }],
    materials: [{ id: "poli", name: "Poliéster / sintética", factor: 1 }, { id: "algodon", name: "Algodón", factor: 1.05 }, { id: "shaggy", name: "Shaggy (pelo largo)", factor: 1.2 }, { id: "natural", name: "Fibras naturales (yute, sisal)", factor: 1.2 }, { id: "lana", name: "Lana", factor: 1.3 }],
  },
];
const muebleSel = (item, e) => ({
  size: item.sizes.find((x) => x.id === (e?.size || item.defSize)) || item.sizes[0],
  mat: item.materials.find((x) => x.id === e?.material) || item.materials[0],
});
const mueblePrice = (item, sel) => round5(item.price * sel.size.factor * sel.mat.factor);
const muebleMin = (item) => round5(item.price * Math.min(...item.sizes.map((x) => x.factor)) * Math.min(...item.materials.map((x) => x.factor)));

const EXTRAS = [
  { id: "pack_auto", name: "Pack Aromatizante para Auto", price: 80, Icon: Wind },
  { id: "gel", name: "Aromatizante en Gel", price: 100, Icon: Droplet },
  { id: "aparato", name: "Aromatizante con Aparato", price: 80, Icon: Fan },
  { id: "tapiceria", name: "Limpiador de tapicería", price: 120, Icon: SprayCan },
  { id: "madera", name: "Limpiador y Lustrador madera", price: 190, Icon: Sparkles },
];

// Datos base del prestador. days/from/to son solo el horario POR DEFECTO (0=lun … 6=dom, horas);
// la agenda real la edita el prestador en su panel y se comparte por store.js (ver liveMember).
// rating/reviews son la calificación inicial, sobre la que se promedian las calificaciones nuevas.
const TEAM = [
  { id: 1, name: "Marcos Ibarra", phone: "6675550142", zone: "Culiacán Centro", rating: 5, reviews: 10, services: ["autos", "hogar", "muebles"], years: 3, days: [0, 1, 2, 3, 4, 5], from: 8, to: 18 },
];
// Cuenta demo de Marcos: teléfono 667 555 0142 y PIN 1234. Los demás prestadores se registran en la app.
const DEMO_PIN = "1234";
const SERVICE_LABEL = { autos: "Autos", hogar: "Hogar", muebles: "Muebles" };
const serviceLabels = (m) => m.services.map((s) => SERVICE_LABEL[s] || s);
const ratingText = (m) => (m.reviews ? `${m.rating.toFixed(1)} (${m.reviews})` : "Nuevo");
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);           // 07:00 – 20:00 (se filtran por la agenda)
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nextDays = (n = 7) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
const dayLabel = (d) => d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
const dayIdx = (date) => (date.getDay() + 6) % 7;
// ¿La agenda del prestador cubre esa fecha y hora? (m viene de liveMember)
const inSchedule = (m, date, hour) => {
  const sd = m.schedule?.[dayIdx(date)];
  return !!m.available && !!sd?.on && hour >= parseInt(sd.from, 10) && hour < parseInt(sd.to, 10);
};
// Además de la agenda, la hora no debe estar tomada por otra solicitud pendiente o aceptada de ese prestador.
const isAvailable = (m, date, hour, cats, reqs) =>
  cats.every((c) => m.services.includes(c)) && inSchedule(m, date, hour)
  && !reqs.some((r) => r.providerId === m.id && (r.status === "pending" || r.status === "accepted") && r.slot?.date === isoDate(date) && r.slot?.hour === hour);


const RATING_QUESTIONS = [
  "¿Qué tan satisfecho(a) estás con la calidad del servicio?",
  "¿El personal fue puntual en la llegada?",
  "¿Cómo calificarías la amabilidad y el profesionalismo?",
  "¿El servicio cumplió con tus expectativas?",
  "¿El tiempo de respuesta fue adecuado?",
];

const timeAgo = (ts) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : `hace ${Math.floor(m / 1440)} d`;
};
const STEPS = ["Pendiente", "En camino", "En proceso", "Finalizado"];

const moneyFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const money = (n) => moneyFmt.format(n);
const yearsLabel = (n) => `${n} año${n === 1 ? "" : "s"}`;

/* ---------------------------------------------------------------------- */
/* Small building blocks                                                   */
/* ---------------------------------------------------------------------- */

function FacebookGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#3B5A96" />
      <path d="M13.6 8.4h1.6V6h-1.9c-1.9 0-2.9 1.1-2.9 3v1.4H8.8v2.4h1.6V18h2.5v-5.2h1.7l.3-2.4h-2V9.2c0-.5.2-.8.7-.8Z" fill="#fff" />
    </svg>
  );
}

function Stepper({ value, onDec, onInc, min = 0 }) {
  return (
    <div className="fw-stepper">
      <button type="button" onClick={onDec} disabled={value <= min} aria-label="Restar">
        <Minus size={13} />
      </button>
      <span>{value}</span>
      <button type="button" onClick={onInc} aria-label="Sumar">
        <Plus size={13} />
      </button>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="fw-statusbar">
      <span> </span>
      <div className="fw-statusbar-icons">
        <span  />
        <span />
        <span  />
      </div>
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div className="fw-topbar">
      <div className="fw-topbar-left">
        {onBack ? (
          <button className="fw-icon-btn" onClick={onBack} aria-label="Volver">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <span className="fw-icon-btn fw-icon-btn--ghost" />
        )}
        <h1>{title}</h1>
      </div>
      <div className="fw-topbar-right">{right}</div>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  const items = [
    { id: "home", label: "Inicio", Icon: HomeIcon },
    { id: "services", label: "Servicios", Icon: Sparkles },
    { id: "wallet", label: "Monedero", Icon: Wallet },
    { id: "history", label: "Actividad", Icon: Clock },
    { id: "profile", label: "Cuenta", Icon: User },
  ];
  return (
    <div className="fw-bottomnav">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`fw-navitem ${active === id ? "is-active" : ""}`}
          onClick={() => onChange(id)}
        >
          <Icon size={20} strokeWidth={active === id ? 2.4 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function StarRow({ value, onChange, size = 22 }) {
  return (
    <div className="fw-starrow">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} estrellas`}>
          <Star size={size} fill={n <= value ? "#F0AE2E" : "none"} color={n <= value ? "#F0AE2E" : "#C9D6D4"} />
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* App                                                                     */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [session, setSession] = usePersistentState("session", false);
  const [stack, setStack] = useState(() => (session ? ["home"] : ["login"]));
  const [activeTab, setActiveTab] = useState("home");
  const screen = stack[stack.length - 1];

  const push = (s) => { window.history.pushState({ fw: 1 }, ""); setStack((prev) => [...prev, s]); };
  // El botón "atrás" de la app y el del navegador comparten la misma ruta: history.back()
  const pop = () => (stack.length > 1 ? window.history.back() : undefined);
  useEffect(() => {
    const onPop = () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const goTab = (tab) => {
    setSession(true);
    setActiveTab(tab);
    setStack([tab]);
  };
  const logout = () => {
  setSession(false);
  clearPersistedState();
  setCart({ autos: {}, hogar: {}, muebles: {}, extras: {} });
  setActiveTab("home");
  setStack(["login"]);
  };

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = usePersistentState("notifs", [
    { id: 1, title: "10% de descuento", text: "En tu próximo lavado Premium.", ts: Date.now(), read: false },
  ]);
  const [toast, setToast] = useState(null);
  const unread = notifs.filter((n) => !n.read).length;
  const notify = (title, text, meta = {}) => {
    const n = { id: Date.now() + Math.random(), title, text, ts: Date.now(), read: false, ...meta };
    setNotifs((l) => [n, ...l].slice(0, 30));
    setToast(n);
  };
  const markAllRead = () => setNotifs((l) => l.map((n) => ({ ...n, read: true })));
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const [catalogTab, setCatalogTab] = useState("autos");

  const [cart, setCart] = usePersistentState("cart", { autos: {}, hogar: {}, muebles: {}, extras: {} });
  const [walletBalance, setWalletBalance] = usePersistentState("wallet", 185.50);
  const setQty = (category, id, qty, extra = {}) => {
    setCart((prev) => {
      const cat = { ...prev[category] };
      if (qty <= 0) delete cat[id];
      else cat[id] = { ...cat[id], ...extra, qty };
      return { ...prev, [category]: cat };
    });
  };

  const totals = useMemo(() => {
    const priceOf = (list, id) => list.find((i) => i.id === id)?.price || 0;
    let subtotal = 0;
    let itemCount = 0;
    const lines = [];
    Object.entries(cart.autos).forEach(([id, e]) => {
      const pkg = AUTO_PACKAGES.find((p) => p.id === id);
      const unit = autoPrice(pkg.price, e.tipo || AUTO_TYPES[0]);
      subtotal += unit * e.qty;
      itemCount += e.qty;
      lines.push({ name: `${pkg.name} (${e.tipo || AUTO_TYPES[0]})`, qty: e.qty, price: unit });
    });
    Object.entries(cart.hogar).forEach(([id, e]) => {
      const it = HOGAR_CATEGORIES.find((p) => p.id === id);
      const areas = hogarAreas(it, e);
      const unit = hogarPrice(it, areas);
      subtotal += unit * e.qty;
      itemCount += e.qty;
      lines.push({ name: `${it.name} · ${hogarLabel(areas)}`, qty: e.qty, price: unit });
    });
    Object.entries(cart.muebles).forEach(([id, e]) => {
      const it = MUEBLES_CATEGORIES.find((p) => p.id === id);
      const sel = muebleSel(it, e);
      const unit = mueblePrice(it, sel);
      subtotal += unit * e.qty;
      itemCount += e.qty;
      lines.push({ name: `${it.name} · ${sel.size.name} · ${sel.mat.name}`, qty: e.qty, price: unit });
    });
    Object.entries(cart.extras).forEach(([id, e]) => {
      const it = EXTRAS.find((p) => p.id === id);
      subtotal += it.price * e.qty;
      itemCount += e.qty;
      lines.push({ name: it.name, qty: e.qty, price: it.price });
    });
    const domicilio = subtotal > 0 ? 35 : 0;
    const cuota = Math.round(subtotal * 0.08 * 100) / 100;
    return { subtotal, domicilio, cuota, total: subtotal + domicilio + cuota, itemCount, lines };
  }, [cart]);

  const [profile, setProfile] = usePersistentState("profile", {
    nombre: "Camila", apellido: "Torres", telefono: "667 123 4567",
    cp: "80200", colonia: "Centro", calle: "Río Tamazula", numero: "145",
  });
  const [editingProfile, setEditingProfile] = useState(false);

  const [paymentMethod, setPaymentMethod] = usePersistentState("payMethod", "tarjeta");
  const [card, setCard] = useState({ nombre: "", numero: "", cvv: "", exp: "" });
  const [simulateFail, setSimulateFail] = useState(false);
  const [showDenied, setShowDenied] = useState(false);

  const [currentOrder, setCurrentOrder] = usePersistentState("order", null);
  const [trackingStep, setTrackingStep] = usePersistentState("trackStep", 0);
  const [history, setHistory] = usePersistentState("orders", []);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [slotDate, setSlotDate] = useState(() => nextDays()[0]);
  const [slotHour, setSlotHour] = useState(null);
  const [chosenProvider, setChosenProvider] = useState(null);
  const [addresses, setAddresses] = usePersistentState("addresses", [
    { id: 1, label: "Casa", street: "Blvd. Universitarios 1520", colonia: "Universitarios", cp: "80010", ref: "Portón negro" },
    { id: 2, label: "Trabajo", street: "Av. Álvaro Obregón 300", colonia: "Centro", cp: "80000", ref: "" },
  ]);
  const [addressId, setAddressId] = usePersistentState("addressId", 1);
  const emptyAddr = { label: "", street: "", colonia: "", cp: "", ref: "" };
  const [addrForm, setAddrForm] = useState(emptyAddr);
  const [addrErr, setAddrErr] = useState({});
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [comms, setComms] = useState(null);
  const incomingId = useIncomingCall(currentOrder ? [currentOrder.id] : [], "client");
  useEffect(() => { if (incomingId && !comms) setComms({ type: "call" }); }, [incomingId]); // eslint-disable-line
  const emptyTopup = { monto: "", nombre: "", numero: "", exp: "", cvv: "" };
  const [topup, setTopup] = useState(emptyTopup);
  const [topupShow, setTopupShow] = useState(false);
  const [walletTx, setWalletTx] = usePersistentState("walletTx", []);
  const [showCardErr, setShowCardErr] = useState(false);
  const [loginForm, setLoginForm] = useState({ phone: "", email: "", pass: "" });
  const [loginErr, setLoginErr] = useState("");
  const [ratings, setRatings] = useState(RATING_QUESTIONS.map(() => 0));
  const [comment, setComment] = useState("");

  // Estado real de la solicitud, escrito por el panel del prestador
  const sharedReqs = useRequests();
  const cfgs = useProviderCfgs();
  const allRatings = useRatings();
  const registered = useProviders();
  const team = useMemo(
    () => [...TEAM, ...registered.filter((p) => p.verified).map(providerToMember)].map((m) => liveMember(m, cfgs, allRatings)),
    [cfgs, allRatings, registered]);
  const [providerMe, setProviderMe] = usePersistentState("providerMe", 1);
  const [pl, setPl] = useState({ tel: "", pin: "", err: "" });
  const [seen, setSeen] = usePersistentState("seen", {});
  const curReq = currentOrder ? sharedReqs.find((x) => x.id === currentOrder.id) : null;
  const allPhotos = usePhotos();
  const orderPhotos = currentOrder ? allPhotos.filter((p) => p.reqId === currentOrder.id).sort((a, b) => a.ts - b.ts).slice(0, 4) : [];
  useEffect(() => {
    const r = curReq;
    if (!r) return;
    const key = `${r.status}:${r.step}`;
    if (seen[r.id] === key) return;
    setSeen((m) => ({ ...m, [r.id]: key }));
    const who = r.providerName;
    if (r.status === "declined") {
      const cb = Math.round(currentOrder.total * 0.03 * 100) / 100;
      setWalletBalance((b) => Math.round((b + currentOrder.total - cb) * 100) / 100);
      notify("Solicitud rechazada", `${who} no pudo tomar tu servicio. Te reembolsamos ${money(currentOrder.total - cb)} al monedero.`, { go: "tracking" });
    } else if (r.status === "done") {
      setTrackingStep(3);
      notify("Servicio finalizado", "Ya puedes calificar tu experiencia.", { go: "rating" });
    } else if (r.status === "accepted") {
      setTrackingStep(r.step);
      notify(...[[`${who} aceptó tu servicio`, "Confirmó tu horario."], ["Tu prestador va en camino", `${who} se dirige a ${r.address?.street || "tu dirección"}.`], ["Servicio en proceso", `${who} comenzó tu servicio.`]][Math.min(r.step, 2)], { go: "tracking" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curReq?.status, curReq?.step, currentOrder?.id]);

  const confirmPayment = () => {
    if (paymentMethod === "tarjeta" && Object.keys(cardErr).length) { setShowCardErr(true); return; }
    if (paymentMethod === "monedero" && walletBalance < totals.total) {
      setShowDenied(true);
      return;
    }
    if (paymentMethod === "tarjeta" && simulateFail) {
      setShowDenied(true);
      return;
    }
    const pickedLive = team.find((m) => m.id === chosenProvider?.id);
    if (!pickedLive || !isAvailable(pickedLive, slotDate, slotHour, cartCats, sharedReqs)) {
      notify("Horario no disponible", "Ese horario acaba de ocuparse o el prestador cambió su agenda. Elige otro.");
      setSlotHour(null); setChosenProvider(null);
      setStack((st) => { const k = st.lastIndexOf("schedule"); return k >= 0 ? st.slice(0, k + 1) : st; });
      return;
    }
    const order = {
      id: Date.now() % 1000000,
      lines: totals.lines,
      total: totals.total,
      createdAt: new Date(),
      employee: chosenProvider,
      address,
      note: orderNote.trim(),
      slot: { date: isoDate(slotDate), label: dayLabel(slotDate), hour: slotHour },
    };
    setCurrentOrder(order);
    const cashback = Math.round(order.total * 0.03 * 100) / 100;
    setWalletBalance((b) => Math.round(((paymentMethod === "monedero" ? b - order.total : b) + cashback) * 100) / 100);
    setCard({ nombre: "", numero: "", cvv: "", exp: "" });
    setShowCardErr(false);
    setOrderNote("");
    setSlotHour(null);
    setChosenProvider(null);
    setCart({ autos: {}, hogar: {}, muebles: {}, extras: {} });
    setTrackingStep(0);
    saveRequest({
      id: order.id, providerId: chosenProvider.id, providerName: chosenProvider.name,
      category: { autos: "Autos", hogar: "Hogar", muebles: "Muebles" }[cartCats[0]] || "Hogar",
      service: order.lines.map((l) => l.name).join(", "),
      detail: order.lines.map((l) => `${l.qty}× ${l.name}`).join(" · "),
      zone: address?.colonia || "", address, note: order.note, slot: order.slot,
      when: `${order.slot.label} · ${pad(order.slot.hour)}:00`, price: totals.subtotal,
    });
    setSeen((m) => ({ ...m, [order.id]: "pending:0" }));
    notify("Solicitud enviada", `Esperando confirmación de ${order.employee?.name}.`, { go: "tracking" });
    push("confirmation");
  };

  const quickRequest = (cat, id, tab) => {
    const current = cart[cat][id]?.qty || 0;
    setQty(cat, id, current + 1);
    setCatalogTab(tab);
    push("catalog");
  };

  const openCatalog = (tab) => {
    setCatalogTab(tab);
    push("catalog");
  };

  const finishRating = () => {
    const given = ratings.filter((v) => v > 0);
    if (!given.length) return;
    if (currentOrder?.employee?.id != null) {
      saveRating({ reqId: currentOrder.id, providerId: currentOrder.employee.id, avg: given.reduce((a, b) => a + b, 0) / given.length, answers: [...ratings], comment: comment.trim().slice(0, 300) });
    }
    setHistory((h) => [{ ...currentOrder, ratings: [...ratings], comment }, ...h]);
    setCurrentOrder(null);
    setRatings(RATING_QUESTIONS.map(() => 0));
    setComment("");
    push("thanks");
  };

  const address = addresses.find((a) => a.id === addressId);
  const cardErr = validateCard(card);
  const saveAddress = () => {
    const e = validateAddress(addrForm);
    setAddrErr(e);
    if (Object.keys(e).length) return;
    const a = { ...addrForm, id: Date.now() };
    setAddresses((l) => [...l, a]); setAddressId(a.id);
    setAddrForm(emptyAddr); setShowAddrForm(false);
  };
  const submitLogin = (kind) => {
    const { phone, email, pass } = loginForm;
    const err = kind === "loginPhone" ? (!validPhone(phone) ? "Ingresa un número de 10 dígitos." : "")
      : !validEmail(email) ? "Ingresa un correo válido." : pass.length < 6 ? "La contraseña debe tener al menos 6 caracteres." : "";
    setLoginErr(err);
    if (!err) goTab("home");
  };
  const allMsgs = useAllMessages();
  const [msgSeen, setMsgSeen] = usePersistentState("msgSeenTs", () => Date.now());
  // Chat abierto: puede venir de una notificación (con reqId propio) o del botón del seguimiento (pedido actual)
  const chatReqId = comms?.type === "chat" ? (comms.reqId ?? currentOrder?.id ?? null) : null;
  const chatOrder = chatReqId != null ? [currentOrder, ...history].find((o) => o && o.id === chatReqId) : null;
  const chatName = comms?.title || chatOrder?.employee?.name || "Tu prestador";
  useEffect(() => {
    const orders = [currentOrder, ...history].filter(Boolean);
    if (!orders.length) return;
    const byId = Object.fromEntries(orders.map((o) => [o.id, o]));
    const fresh = allMsgs.filter((m) => byId[m.reqId] && m.from === "provider" && m.ts > msgSeen);
    if (!fresh.length) return;
    setMsgSeen(Math.max(...fresh.map((m) => m.ts)));
    // Un aviso por conversación, salvo la que el cliente ya está viendo
    [...new Set(fresh.map((m) => m.reqId))].filter((id) => id !== chatReqId).forEach((id) => {
      const last = fresh.filter((m) => m.reqId === id).slice(-1)[0];
      const who = byId[id].employee?.name || "tu prestador";
      notify(`Mensaje de ${who}`, last.text.length > 70 ? last.text.slice(0, 70) + "…" : last.text, { kind: "message", reqId: id, who });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMsgs.length, currentOrder?.id]);
  // Al abrir un chat (desde donde sea) sus avisos de mensaje quedan leídos
  useEffect(() => {
    if (chatReqId == null) return;
    setNotifs((l) => (l.some((n) => n.kind === "message" && n.reqId === chatReqId && !n.read)
      ? l.map((n) => (n.kind === "message" && n.reqId === chatReqId ? { ...n, read: true } : n)) : l));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatReqId, allMsgs.length]);
  // Avisos de mensaje (también los guardados antes de esta versión, que no traen reqId)
  const isMsgNotif = (n) => n.kind === "message" || (/^Mensaje de/.test(n.title) && !!currentOrder);
  // A dónde lleva cada aviso: mensaje, seguimiento, calificación, monedero o actividad (los avisos viejos sin destino se infieren del título)
  const notifTarget = (n) => {
    let t = isMsgNotif(n) ? "chat" : n.go
      || (/finalizado/i.test(n.title) ? "rating" : /aceptó|camino|proceso|rechazada|enviada/i.test(n.title) ? "tracking" : /Depósito/.test(n.title) ? "wallet" : null);
    if ((t === "tracking" || t === "rating") && !currentOrder) t = "history"; // el servicio ya se calificó
    return t;
  };
  const NOTIF_CTA = { chat: "Ver mensaje ›", tracking: "Ver seguimiento ›", rating: "Calificar servicio ›", wallet: "Ver monedero ›", history: "Ver actividad ›" };
  const openNotif = (n) => {
    setToast(null);
    setShowNotifs(false);
    setNotifs((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    const t = notifTarget(n);
    if (t === "chat") { setComms({ type: "chat", reqId: n.reqId ?? currentOrder?.id, title: n.who }); return; }
    if (t === "tracking" || t === "rating") { goTab("home"); push(t); return; }
    if (t === "wallet" || t === "history") { goTab(t); return; }
    goTab("home");
  };
  const topupAmount = parseFloat(topup.monto);
  const topupErr = validateCard(topup);
  if (!(topupAmount >= 200)) topupErr.monto = "El depósito mínimo es $200.00.";
  else if (topupAmount > 10000) topupErr.monto = "El máximo por depósito es $10,000.00.";
  const doTopup = () => {
    setTopupShow(true);
    if (Object.keys(topupErr).length) return;
    const amt = Math.round(topupAmount * 100) / 100;
    setWalletBalance((b) => Math.round((b + amt) * 100) / 100);
    setWalletTx((l) => [{ id: Date.now(), label: `Depósito con tarjeta ···${topup.numero.slice(-4)}`, amount: amt, ts: Date.now() }, ...l].slice(0, 20));
    notify("Depósito exitoso", `Se abonaron ${money(amt)} a tu monedero.`, { go: "wallet" });
    setTopup(emptyTopup); setTopupShow(false);
  };
  const cartCats = ["autos", "hogar", "muebles"].filter((c) => Object.keys(cart[c]).length > 0);
  const now = new Date();
  const hourIsPast = (h) => isoDate(slotDate) === isoDate(now) && h <= now.getHours();
  const availableProviders = slotHour == null ? [] : team.filter((m) => isAvailable(m, slotDate, slotHour, cartCats, sharedReqs));
  const canServe = (m) => cartCats.every((c) => m.services.includes(c));
  const dayOffered = (d) => team.some((m) => canServe(m) && m.available && m.schedule[dayIdx(d)]?.on);
  const hoursInAgenda = HOURS.filter((h) => team.some((m) => canServe(m) && inSchedule(m, slotDate, h)));
  const hourFree = (h) => team.some((m) => isAvailable(m, slotDate, h, cartCats, sharedReqs));

  // Servicio en curso: siempre se puede volver a su seguimiento o calificarlo desde Inicio y Actividad
  const serviceDone = !!currentOrder && (trackingStep >= 3 || curReq?.status === "done");
  const serviceDeclined = curReq?.status === "declined";
  const activeLabel = serviceDeclined ? "Solicitud rechazada" : serviceDone ? "Servicio finalizado" : curReq?.status === "accepted" ? (trackingStep === 0 ? "Confirmado" : STEPS[Math.min(trackingStep, 3)]) : "Esperando confirmación";
  const renderActiveCard = (withMap) => currentOrder && (
    <section className="fw-section">
      <h3>{serviceDone ? "Califica tu servicio" : "Tu servicio"}</h3>
      <div className="fw-card fw-active">
        <div className="fw-active-top">
          <div className="fw-avatar"><User size={20} /></div>
          <div><strong>{currentOrder.employee?.name || "Tu prestador"}</strong><span className="fw-muted">{activeLabel} · Solicitud #{currentOrder.id}</span></div>
        </div>
        {withMap && <TrackingMap reqId={curReq?.id} compact onOpen={() => push("tracking")} step={trackingStep} status={curReq?.status || "pending"} providerName={currentOrder.employee?.name} providerLoc={curReq?.providerLoc} street={currentOrder.address?.street} />}
        <div className="fw-active-actions">
          <button className={serviceDone ? "fw-btn-outline" : "fw-btn-primary"} onClick={() => push("tracking")}>Ver seguimiento</button>
          {serviceDone && <button className="fw-btn-primary" onClick={() => push("rating")}>Calificar servicio</button>}
        </div>
      </div>
    </section>
  );
  const renderNotifSheet = () => (
    <div className="fw-notif-sheet">
      <button className="fw-notif-back" aria-label="Cerrar notificaciones" onClick={() => setShowNotifs(false)} />
      <div className="fw-notif-panel" role="dialog" aria-label="Notificaciones">
        <div className="fw-notif-head">
          <strong>Notificaciones</strong>
          <span className="fw-notif-tools">
            {unread > 0 && <button className="fw-linklike" onClick={markAllRead}>Marcar leídas</button>}
            <button className="fw-linklike" onClick={() => setShowNotifs(false)}>Cerrar</button>
          </span>
        </div>
        {notifs.length === 0 ? <p>No tienes notificaciones.</p> : notifs.map((n) => {
          const t = notifTarget(n);
          return (
            <button key={n.id} className={`fw-notif-item ${n.read ? "" : "is-unread"}`} onClick={() => openNotif(n)}>
              <strong>{t === "chat" && <MessageCircle size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />}{n.title}</strong><br />{n.text}<br />
              <small>{timeAgo(n.ts)}</small>{t && <span className="fw-notif-cta">{NOTIF_CTA[t]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  const showBottomNav = stack.length === 1 && ["home", "services", "wallet", "history", "profile"].includes(screen);

  /* ---------------------------- render helpers --------------------------- */

  const renderLogin = () => (
    <div className="fw-screen fw-login">
      <div className="fw-login-hero">
        <span className="fw-country">México</span>
        <h1>
          Obtén un aromatizante <em>gratis</em> en tu primera reserva
        </h1>
        <p>*Válido para nuevos usuarios. Aplican términos y condiciones.</p>
      </div>
      <img
        src={logoFlexiWash}
        alt="FlexiWash"
        className="fw-login-logo"
      />
      <div className="fw-login-actions">
        <button className="fw-authbtn fw-authbtn--phone" onClick={() => push("loginPhone")}>
          <Smartphone size={18} /> Continúa con tu celular
        </button>
        <button className="fw-authbtn fw-authbtn--fb" onClick={() => push("loginFacebook")}>
          <FacebookGlyph size={18} /> Continúa con tu Facebook
        </button>
        <button className="fw-authbtn fw-authbtn--mail" onClick={() => push("loginEmail")}>
          <Mail size={18} /> Continúa con tu Correo
        </button>
        <button className="fw-authbtn fw-authbtn--ghost" onClick={() => push("loginAccount")}>
          <User size={18} /> Ya tengo cuenta
        </button>
        <button className="fw-provider-entry" onClick={() => push("providerLogin")}>
          <ShieldCheck size={18} /> Soy prestador de servicios
        </button>
      </div>
      <p className="fw-login-foot">FlexiWash · Culiacán, Sinaloa</p>
    </div>
  );

  const renderLoginSub = (kind) => {
    const meta = {
      loginPhone: { title: "Ingresa tu número celular", sub: "Te enviaremos un código para confirmarlo." },
      loginEmail: { title: "Ingresa a tu cuenta", sub: "Te enviaremos un código para confirmarlo." },
      loginFacebook: { title: "Ingresa a tu cuenta", sub: "Usaremos tu correo de Facebook." },
      loginAccount: { title: "Continúa con:", sub: "Recuperamos tu perfil guardado." },
    }[kind];
    return (
      <div className="fw-screen">
        <TopBar title="" onBack={pop} />
        <div className="fw-authform">
          <h2>{meta.title}</h2>
          <p>{meta.sub}</p>
          {kind === "loginFacebook" && (
            <div className="fw-fb-badge">
              <FacebookGlyph size={54} />
            </div>
          )}
          {kind === "loginPhone" ? (
            <div className="fw-phone-input">
              <span>🇲🇽 +52</span>
              <input placeholder="Número de teléfono" inputMode="numeric" autoComplete="tel-national" maxLength={10} aria-label="Teléfono" value={loginForm.phone} onChange={(e) => { setLoginForm({ ...loginForm, phone: onlyDigits(e.target.value) }); setLoginErr(""); }} />
            </div>
          ) : (
            <>
              <input className="fw-input" placeholder="Correo electrónico" type="email" autoComplete="email" value={loginForm.email} onChange={(e) => { setLoginForm({ ...loginForm, email: e.target.value }); setLoginErr(""); }} />
              <input className="fw-input" placeholder="Contraseña" type="password" autoComplete="current-password" value={loginForm.pass} onChange={(e) => { setLoginForm({ ...loginForm, pass: e.target.value }); setLoginErr(""); }} />
            </>
          )}
          {loginErr && <p className="fw-field-err" role="alert">{loginErr}</p>}
          <button className="fw-btn-primary fw-btn-block" onClick={() => submitLogin(kind)}>
            {kind === "loginAccount" ? "Iniciar sesión" : "Confirmar"}
          </button>
          {kind === "loginAccount" && (
            <button className="fw-linklike" onClick={() => goTab("home")}>
              Continuar como invitado
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderHome = () => (
    <div className="fw-screen">
      <div className="fw-home-top">
        <button className="fw-addr">
          Dirección 1… <ChevronLeft size={14} className="fw-rot" />
        </button>
        <div className="fw-home-top-icons">
          <button className="fw-icon-btn" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`} aria-haspopup="dialog" aria-expanded={showNotifs} onClick={() => setShowNotifs(true)}>
            <Bell size={19} />
            {unread > 0 && <span className="fw-badge">{unread}</span>}
          </button>
          <button className="fw-icon-btn" onClick={() => openCatalog(catalogTab)}>
            <ShoppingCart size={19} />
            {totals.itemCount > 0 && <span className="fw-badge">{totals.itemCount}</span>}
          </button>
        </div>
      </div>

      <div className="fw-search"><Search size={16} /><span>Buscar en FlexiWash</span></div>

      {renderActiveCard(true)}

      <section className="fw-section">
        <h3>Servicios</h3>
        <div className="fw-services-row fw-services-row--4">
          <button className="fw-service-tile" onClick={() => openCatalog("autos")}><div className="fw-tile-icon fw-tile-icon--autos"><Car size={22} /></div><span>Autos</span></button>
          <button className="fw-service-tile" onClick={() => openCatalog("hogar")}><div className="fw-tile-icon fw-tile-icon--hogar"><HomeIcon size={22} /></div><span>Hogar</span></button>
          <button className="fw-service-tile" onClick={() => openCatalog("muebles")}><div className="fw-tile-icon fw-tile-icon--muebles"><Sofa size={22} /></div><span>Muebles</span></button>
          <button className="fw-service-tile" onClick={() => openCatalog("extras")}><div className="fw-tile-icon fw-tile-icon--extras"><SprayCan size={22} /></div><span>Extras</span></button>
        </div>
      </section>

      <section className="fw-section">
        <h3>Solicitar de nuevo</h3>
        <div className="fw-quick-row">
          <button className="fw-quick" style={{ "--fw-q": "var(--fw-hogar)" }} onClick={() => quickRequest("muebles", "colchon", "muebles")}>
            <BedDouble size={20} />
          </button>
          <button className="fw-quick" style={{ "--fw-q": "var(--fw-auto)" }} onClick={() => quickRequest("autos", "express", "autos")}>
            <Sparkles size={20} />
          </button>
          <button className="fw-quick" style={{ "--fw-q": "var(--fw-hogar)" }} onClick={() => quickRequest("hogar", "basica", "hogar")}>
            <Bath size={20} />
          </button>
          <button className="fw-quick" style={{ "--fw-q": "var(--fw-auto)" }} onClick={() => quickRequest("autos", "premium", "autos")}>
            <Wind size={20} />
          </button>
        </div>
      </section>

      <section className="fw-section">
        <h3>Promociones</h3>
        <div className="fw-promo">
          <div>
            <strong>Sé miembro de la App</strong>
            <p>Recibe prioridad y precios exclusivos.</p>
          </div>
          <Wallet size={28} />
        </div>
      </section>
    </div>
  );

  const catalogMeta = {
    autos: { label: "Autos", Icon: Car, accent: "auto", items: AUTO_PACKAGES, list: "autos" },
    hogar: { label: "Hogar", Icon: HomeIcon, accent: "hogar", items: HOGAR_CATEGORIES, list: "hogar" },
    muebles: { label: "Muebles", Icon: Sofa, accent: "muebles", items: MUEBLES_CATEGORIES, list: "muebles" },
    extras: { label: "Extras", Icon: SprayCan, accent: "extras", items: EXTRAS, list: "extras" },
  };

  const renderCatalog = () => {
    const meta = catalogMeta[catalogTab];
    return (
      <div className="fw-screen fw-screen--pad-bottom">
        <TopBar title={meta.label} onBack={pop} />
        <div className="fw-segmented">
          {Object.entries(catalogMeta).map(([key, m]) => (
            <button
              key={key}
              className={`fw-seg ${catalogTab === key ? "is-active" : ""}`}
              onClick={() => setCatalogTab(key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className={`fw-catalog-hero fw-catalog-hero--${meta.accent}`}>
          <meta.Icon size={30} />
        </div>

        {catalogTab === "autos" && <p className="fw-muted" style={{ margin: "0 0 8px" }}>El precio cambia según el tipo de vehículo: Sedán (base), SUV +25%, Pickup +35%, Motocicleta −40%.</p>}
        {catalogTab === "hogar" && <p className="fw-muted" style={{ margin: "0 0 8px" }}>El precio cambia según las áreas que elijas limpiar.</p>}
        {catalogTab === "muebles" && <p className="fw-muted" style={{ margin: "0 0 8px" }}>El precio cambia según el tamaño y el material del mueble. Especifícalos al agregarlo.</p>}
        <div className="fw-catalog-list">
          {meta.items.map((item) => {
            const entry = cart[meta.list][item.id] || { qty: 0, tipo: AUTO_TYPES[0] };
            const hSel = catalogTab === "hogar" ? hogarAreas(item, entry) : null;
            const mSel = catalogTab === "muebles" ? muebleSel(item, entry) : null;
            const added = entry.qty > 0;
            let priceText;
            if (catalogTab === "autos") priceText = `${money(autoPrice(item.price, entry.tipo || AUTO_TYPES[0]))} · ${entry.tipo || AUTO_TYPES[0]}`;
            else if (hSel) priceText = added ? `${money(hogarPrice(item, hSel))} / servicio` : `Desde ${money(item.min)}`;
            else if (mSel) priceText = added ? `${money(mueblePrice(item, mSel))} / pieza · ${mSel.size.name} · ${mSel.mat.name}` : `Desde ${money(muebleMin(item))} / pieza`;
            else priceText = money(item.price);
            const setAreas = (id, n) => setQty("hogar", item.id, entry.qty, { areas: { ...hSel, [id]: n } });
            return (
              <div key={item.id} className="fw-catalog-item">
                <div className={`fw-catalog-icon fw-catalog-icon--${meta.accent}`}>
                  <item.Icon size={19} />
                </div>
                <div className="fw-catalog-info">
                  <div className="fw-catalog-name">{item.name}</div>
                  <div className="fw-catalog-desc">{item.desc}</div>
                  <div className="fw-catalog-price">
                    {priceText}
                  </div>
                  {mSel && added && (
                    <div className="fw-opts">
                      <label className="fw-opt"><span>Tamaño</span>
                        <select className="fw-select" value={mSel.size.id} onChange={(e) => setQty("muebles", item.id, entry.qty, { size: e.target.value })}>
                          {item.sizes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </label>
                      <label className="fw-opt"><span>Material</span>
                        <select className="fw-select" value={mSel.mat.id} onChange={(e) => setQty("muebles", item.id, entry.qty, { material: e.target.value })}>
                          {item.materials.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                  {hSel && added && (
                    <div className="fw-areas" role="group" aria-label="Áreas a limpiar">
                      {HOGAR_AREAS.map((a) => {
                        const n = hSel[a.id] || 0;
                        return (
                          <div key={a.id} className={`fw-area ${n > 0 ? "is-on" : ""}`}>
                            <span>{a.name}</span>
                            <div className="fw-area-ctl">
                              <button type="button" aria-label={`Quitar ${a.name}`} disabled={n <= 0 || areaTotal(hSel) <= 1} onClick={() => setAreas(a.id, n - 1)}><Minus size={11} /></button>
                              <b>{n}</b>
                              <button type="button" aria-label={`Agregar ${a.name}`} disabled={n >= 5} onClick={() => setAreas(a.id, n + 1)}><Plus size={11} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {catalogTab === "autos" && entry.qty > 0 && (
                    <select
                      className="fw-select"
                      value={entry.tipo || AUTO_TYPES[0]}
                      onChange={(e) => setQty("autos", item.id, entry.qty, { tipo: e.target.value })}
                    >
                      {AUTO_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  )}
                </div>
                <Stepper
                  value={entry.qty}
                  onDec={() => setQty(meta.list, item.id, Math.max(0, entry.qty - 1), catalogTab === "autos" ? { tipo: entry.tipo } : {})}
                  onInc={() => setQty(meta.list, item.id, entry.qty + 1, catalogTab === "autos" ? { tipo: entry.tipo || AUTO_TYPES[0] } : {})}
                />
              </div>
            );
          })}
        </div>

        <div className="fw-summary-bar">
          <div className="fw-summary-rows">
            <div><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div><span>Domicilio</span><span>{money(totals.domicilio)}</span></div>
            <div><span>Cuota de servicio</span><span>{money(totals.cuota)}</span></div>
            <div className="fw-summary-total"><span>Total</span><span>{money(totals.total)}</span></div>
          </div>
          <button className="fw-btn-primary fw-btn-block" disabled={totals.total === 0} onClick={() => { setSlotHour(null); setChosenProvider(null); push("schedule"); }}>
            Elegir fecha y hora
          </button>
        </div>
      </div>
    );
  };

  const renderSchedule = () => (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="Fecha y hora" onBack={pop} />
      <h3 className="fw-section-title">¿Cuándo necesitas el servicio?</h3>
      <div className="fw-slots fw-slots--days" role="group" aria-label="Fecha">
        {nextDays().map((d) => (
          <button key={isoDate(d)} disabled={!dayOffered(d)} className={`fw-slot ${isoDate(d) === isoDate(slotDate) ? "is-on" : ""}`} onClick={() => { setSlotDate(d); setSlotHour(null); }}>{dayLabel(d)}</button>
        ))}
      </div>
      <h3 className="fw-section-title">Hora de llegada</h3>
      <div className="fw-slots" role="group" aria-label="Hora">
        {hoursInAgenda.map((h) => (
          <button key={h} disabled={hourIsPast(h) || !hourFree(h)} className={`fw-slot ${slotHour === h ? "is-on" : ""}`} onClick={() => setSlotHour(h)}>{pad(h)}:00</button>
        ))}
      </div>
      {hoursInAgenda.length === 0 && <p className="fw-muted" role="status">No hay horarios disponibles este día. Prueba con otra fecha.</p>}
      <div className="fw-summary-bar">
        <button className="fw-btn-primary fw-btn-block" disabled={slotHour == null} onClick={() => { setChosenProvider(null); push("providers"); }}>Ver prestadores disponibles</button>
      </div>
    </div>
  );

  const renderProviders = () => (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="Elige tu prestador" onBack={pop} />
      <p className="fw-muted">Disponibles el {dayLabel(slotDate)} a las {pad(slotHour)}:00</p>
      {availableProviders.length === 0 ? (
        <div className="fw-empty">
          <Clock size={30} />
          <p>Nadie está disponible a esa hora.</p>
          <span>Prueba con otro horario u otro día.</span>
          <button className="fw-btn-outline" onClick={pop}>Cambiar horario</button>
        </div>
      ) : (
        <div className="fw-provider-list">
          {availableProviders.map((m) => (
            <button key={m.id} className={`fw-employee-card fw-pick ${chosenProvider?.id === m.id ? "is-on" : ""}`} aria-pressed={chosenProvider?.id === m.id} onClick={() => setChosenProvider(m)}>
              <div className="fw-avatar"><User size={20} /></div>
              <div>
                <strong>{m.name}</strong>
                <div className="fw-stars-mini">{"★".repeat(Math.round(m.rating))} <span className="fw-muted">{ratingText(m)}{m.years ? ` · ${yearsLabel(m.years)} de experiencia` : ""} · {serviceLabels(m).join(", ")}</span></div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="fw-summary-bar">
        <button className="fw-btn-primary fw-btn-block" disabled={!chosenProvider} onClick={() => push("summary")}>Revisar resumen</button>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="Resumen de tu servicio" onBack={pop} />
      <div className="fw-card fwp-sum">
        <div className="fw-order-line"><span>Fecha y hora</span><strong>{dayLabel(slotDate)} · {pad(slotHour)}:00</strong></div>
        <div className="fw-order-line"><span>Prestador</span><strong>{chosenProvider?.name}</strong></div>
        <div className="fw-order-line"><span>Dirección</span>
          <span style={{ textAlign: "right" }}><strong>{address ? `${address.label}` : "Sin dirección"}</strong><br />{address && `${address.street}, ${address.colonia}, CP ${address.cp}`}<br />
            <button className="fw-linklike" onClick={() => push("address")}>{address ? "Cambiar" : "Agregar dirección"}</button></span></div>
      </div>
      <div className="fw-card">
        {totals.lines.map((l, i) => <div key={i} className="fw-order-line"><span>{l.qty}× {l.name}</span><span>{money(l.price * l.qty)}</span></div>)}
        <div className="fw-order-line"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
        <div className="fw-order-line"><span>Domicilio</span><span>{money(totals.domicilio)}</span></div>
        <div className="fw-order-line"><span>Cuota de servicio</span><span>{money(totals.cuota)}</span></div>
        <div className="fw-order-line fw-summary-total"><span>Total</span><span>{money(totals.total)}</span></div>
      </div>
      <label className="fwp-col"><span className="fwp-label">Indicaciones para el prestador (opcional)</span>
        <textarea className="fw-input" rows={3} maxLength={200} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Ej. Tocar el timbre, estacionamiento visitas…" /></label>
      <div className="fw-summary-bar">
        <button className="fw-btn-primary fw-btn-block" disabled={!address} onClick={() => push("payment")}>Continuar al pago</button>
      </div>
    </div>
  );

  const renderAddress = () => (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="Dirección del servicio" onBack={pop} />
      <div className="fw-provider-list">
        {addresses.map((a) => (
          <button key={a.id} className={`fw-employee-card fw-pick ${a.id === addressId ? "is-on" : ""}`} aria-pressed={a.id === addressId} onClick={() => setAddressId(a.id)}>
            <div className="fw-avatar"><MapPin size={20} /></div>
            <div style={{ textAlign: "left" }}><strong>{a.label}</strong><br /><span className="fw-muted">{a.street}, {a.colonia}, CP {a.cp}{a.ref && ` · ${a.ref}`}</span></div>
          </button>
        ))}
      </div>
      {showAddrForm ? (
        <div className="fw-card fwp-col">
          {[["label", "Nombre (Casa, Trabajo…)"], ["street", "Calle y número"], ["colonia", "Colonia"], ["cp", "Código postal"], ["ref", "Referencias (opcional)"]].map(([k, ph]) => (
            <div key={k}>
              <input className="fw-input" placeholder={ph} aria-label={ph} inputMode={k === "cp" ? "numeric" : undefined} maxLength={k === "cp" ? 5 : 80}
                value={addrForm[k]} onChange={(e) => setAddrForm({ ...addrForm, [k]: k === "cp" ? onlyDigits(e.target.value) : e.target.value })} />
              {addrErr[k] && <p className="fw-field-err" role="alert">{addrErr[k]}</p>}
            </div>
          ))}
          <button className="fw-btn-primary fw-btn-block" onClick={saveAddress}>Guardar dirección</button>
          <button className="fw-linklike" onClick={() => { setShowAddrForm(false); setAddrErr({}); }}>Cancelar</button>
        </div>
      ) : (
        <button className="fw-btn-outline fw-btn-block" onClick={() => setShowAddrForm(true)}>+ Agregar nueva dirección</button>
      )}
      <div className="fw-summary-bar"><button className="fw-btn-primary fw-btn-block" disabled={!address} onClick={pop}>Usar esta dirección</button></div>
    </div>
  );

  const renderPayment = () => (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="Método de pago" onBack={pop} />
      <div className="fw-paylist">
        {[
          { id: "efectivo", label: "Efectivo", Icon: Wallet },
          { id: "tarjeta", label: "Tarjeta", Icon: CreditCard },
          { id: "paypal", label: "PayPal", Icon: Smartphone },
          { id: "monedero", label: `Monedero FlexiWash · ${money(walletBalance)}`, Icon: Wallet },
        ].map(({ id, label, Icon }) => (
          <div key={id} className={`fw-payopt ${paymentMethod === id ? "is-active" : ""}`}>
            <button className="fw-payopt-head" onClick={() => setPaymentMethod(id)}>
              <span className="fw-radio">{paymentMethod === id && <span />}</span>
              <Icon size={20} />
              <span>{label}</span>
            </button>
            {id === "tarjeta" && paymentMethod === "tarjeta" && (
              <div className="fw-cardform">
                <button type="button" className="fw-linklike" onClick={() => setCard({ ...card, ...testCard() })}>Usar tarjeta de prueba</button>
                <input className="fw-input" placeholder="Nombre del titular" autoComplete="cc-name" value={card.nombre} onChange={(e) => setCard({ ...card, nombre: e.target.value })} />
                {showCardErr && cardErr.nombre && <p className="fw-field-err" role="alert">{cardErr.nombre}</p>}
                <input className="fw-input" placeholder="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" value={card.numero} onChange={(e) => setCard({ ...card, numero: formatCardNumber(e.target.value) })} />
                {showCardErr && cardErr.numero && <p className="fw-field-err" role="alert">{cardErr.numero}</p>}
                <div className="fw-cardform-row">
                  <input className="fw-input" placeholder="CVV" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: onlyDigits(e.target.value) })} />
                  <input className="fw-input" placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" value={card.exp} onChange={(e) => setCard({ ...card, exp: formatExp(e.target.value) })} />
                </div>
                {showCardErr && (cardErr.exp || cardErr.cvv) && <p className="fw-field-err" role="alert">{cardErr.exp || cardErr.cvv}</p>}
                {import.meta.env.DEV && (
                  <label className="fw-checkline">
                    <input type="checkbox" checked={simulateFail} onChange={(e) => setSimulateFail(e.target.checked)} />
                    Simular pago rechazado (solo desarrollo)
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="fw-summary-bar">
        <div className="fw-summary-rows">
          <div className="fw-summary-total"><span>Total a pagar</span><span>{money(totals.total)}</span></div>
        </div>
        <button className="fw-btn-primary fw-btn-block" onClick={confirmPayment}>
          Confirmar pago
        </button>
      </div>

      {showDenied && (
        <div className="fw-modal-veil">
          <div className="fw-modal">
            <AlertTriangle size={30} color="var(--fw-error)" />
            <strong>Pago denegado</strong>
            <p>{paymentMethod === "monedero" ? "Saldo insuficiente. Recarga tu monedero o usa otro método." : "Intenta con otro método de pago."}</p>
            <button className="fw-btn-outline" onClick={() => setShowDenied(false)}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );

  const renderConfirmation = () => (
    <div className="fw-screen fw-center">
      <div className="fw-confirm-icon"><CheckCircle2 size={46} color="#fff" /></div>
      <h2>¡Todo listo!</h2>
      <p>Solicitud #{currentOrder?.id} para el {currentOrder?.slot.label} a las {pad(currentOrder?.slot.hour)}:00.</p>
      <p>{currentOrder?.address && `${currentOrder.address.street}, ${currentOrder.address.colonia}`}</p>
      <p><strong>Esperando confirmación de {currentOrder?.employee.name}.</strong> Te avisaremos cuando acepte.</p>
      <div className="fw-card fw-order-summary">
        {currentOrder?.lines.map((l, i) => (
          <div key={i} className="fw-order-line"><span>{l.qty}× {l.name}</span><span>{money(l.price * l.qty)}</span></div>
        ))}
        <div className="fw-order-line fw-summary-total"><span>Total</span><span>{money(currentOrder?.total || 0)}</span></div>
      </div>
      <button className="fw-btn-primary fw-btn-block" onClick={() => push("tracking")}>Ver seguimiento</button>
      <button className="fw-linklike" onClick={() => goTab("home")}>Volver al inicio</button>
    </div>
  );

  const renderTracking = () => {
    const finished = trackingStep >= 3;
    return (
      <div className="fw-screen fw-screen--pad-bottom">
        <TopBar title="Estado del servicio" onBack={() => goTab("home")} />
        <div className="fw-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`fw-step ${i <= trackingStep ? "is-done" : ""}`}>
              <span className="fw-step-dot" />
              <span>{s}</span>
            </div>
          ))}
        </div>

        <TrackingMap reqId={curReq?.id} onChat={() => setComms({ type: "chat" })} onCall={() => { startCall(currentOrder.id, "client"); setComms({ type: "call" }); }} step={trackingStep} status={curReq?.status || "pending"} providerName={currentOrder?.employee?.name} providerLoc={curReq?.providerLoc} street={currentOrder?.address?.street} />

        {curReq?.status === "pending" && <p className="fw-muted" role="status">Esperando a que {curReq.providerName} acepte tu solicitud…</p>}
        {curReq?.status === "declined" && <div className="fw-card" role="alert"><strong>Solicitud rechazada.</strong> Reembolsamos tu pago al monedero. Puedes solicitar de nuevo con otro prestador.</div>}

        {currentOrder?.employee && (
          <button className="fw-employee-card" onClick={() => { setSelectedEmployee(currentOrder.employee); push("employeeDetail"); }}>
            <div className="fw-avatar"><User size={20} /></div>
            <div>
              <strong>{currentOrder.employee.name}</strong>
              {(() => { const em = team.find((t) => t.id === currentOrder.employee.id) || currentOrder.employee; return <div className="fw-stars-mini">{"★".repeat(Math.round(em.rating))} <span className="fw-muted">{em.reviews ? em.rating.toFixed(1) : "Nuevo"}</span></div>; })()}
            </div>
            <span className="fw-linklike">Ver perfil</span>
          </button>
        )}

        {(trackingStep >= 2 || orderPhotos.length > 0) && (
          <>
            <h3 className="fw-section-title">Imágenes del servicio</h3>
            <div className="fw-cam-grid">
              {Array.from({ length: 4 }).map((_, i) => orderPhotos[i] ? (
                <a key={orderPhotos[i].id} className="fw-cam fw-cam--img" href={orderPhotos[i].url} target="_blank" rel="noreferrer" aria-label={`Ver foto ${i + 1} del servicio`}>
                  <img src={orderPhotos[i].url} alt={`Foto ${i + 1} del servicio`} loading="lazy" />
                  <span className="fw-cam-label">{i + 1}</span>
                </a>
              ) : (
                <div key={i} className="fw-cam">
                  <span className="fw-cam-label">{i + 1}</span>
                  <Camera size={22} />
                </div>
              ))}
            </div>
            {orderPhotos.length === 0 && <p className="fw-muted">Tu prestador subirá aquí las fotos del servicio.</p>}
          </>
        )}
        {finished && (
          <button className="fw-btn-primary fw-btn-block" onClick={() => push("rating")}>
            Calificar servicio
          </button>
        )}
      </div>
    );
  };

  const renderEmployeeDetail = () => {
    const e = selectedEmployee && (team.find((t) => t.id === selectedEmployee.id) || selectedEmployee);
    if (!e) return null;
    const comments = allRatings.filter((r) => r.providerId === e.id && r.comment).slice(-3).reverse();
    return (
      <div className="fw-screen">
        <TopBar title="Empleado" onBack={pop} />
        <div className="fw-center">
          <div className="fw-avatar fw-avatar--lg"><User size={30} /></div>
          <h2>{e.name}</h2>
          <div className="fw-stars-mini">{"★".repeat(Math.round(e.rating))}{"☆".repeat(5 - Math.round(e.rating))} <span className="fw-muted">{ratingText(e)}</span></div>
          <p className="fw-muted">{e.years ? `${yearsLabel(e.years)} de experiencia · ` : "Nuevo en FlexiWash · "}{serviceLabels(e).join(" · ")}</p>
        </div>
        <h3 className="fw-section-title">Verificación de seguridad</h3>
        <div className="fw-verify-row">
          <div><ShieldCheck size={22} /><span>Identidad</span></div>
          <div><FileCheck2 size={22} /><span>Antecedentes</span></div>
          <div><HeartHandshake size={22} /><span>Cobertura</span></div>
        </div>
        <h3 className="fw-section-title">Comentarios de clientes</h3>
        {comments.map((c) => <div key={c.reqId} className="fw-card">“{c.comment}”</div>)}
        <div className="fw-card">“Muy puntual y cuidadoso con mi auto, quedó impecable.”</div>
      </div>
    );
  };

  const renderRating = () => (
    <div className="fw-screen fw-screen--pad-bottom">
      <TopBar title="Calificación del servicio" onBack={pop} />
      <div className="fw-rating-list">
        {RATING_QUESTIONS.map((q, i) => (
          <div key={i} className="fw-rating-item">
            <p>{q}</p>
            <StarRow value={ratings[i]} onChange={(v) => setRatings((r) => r.map((x, idx) => (idx === i ? v : x)))} />
          </div>
        ))}
      </div>
      <textarea className="fw-textarea" placeholder="Añade un comentario…" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="fw-summary-bar">
        <button className="fw-btn-primary fw-btn-block" disabled={!ratings.some((v) => v > 0)} onClick={finishRating}>Enviar calificación</button>
      </div>
    </div>
  );

  const renderThanks = () => (
    <div className="fw-screen fw-center">
      <div className="fw-confirm-icon" style={{ background: "var(--fw-gold)" }}><Star size={40} color="#fff" fill="#fff" /></div>
      <h2>¡Gracias por tu calificación!</h2>
      <p>Tu opinión nos ayuda a mejorar cada servicio de FlexiWash.</p>
      <button className="fw-btn-primary fw-btn-block" onClick={() => goTab("home")}>Volver al inicio</button>
    </div>
  );

  const renderHistory = () => (
    <div className="fw-screen">
      <TopBar title="Historial" />
      {renderActiveCard(false)}
      {history.length === 0 ? (
        <div className="fw-empty">
          <Clock size={30} />
          <p>Aún no tienes servicios completados.</p>
          <span>Cuando termines un servicio, aparecerá aquí junto con tu calificación.</span>
        </div>
      ) : (
        <div className="fw-history-list">
          {history.map((o) => (
            <div key={o.id} className="fw-card fw-history-item">
              <div className="fw-history-item-top">
                <strong>Solicitud #{o.id}</strong>
                <span>{money(o.total)}</span>
              </div>
              <p className="fw-muted">{o.lines.map((l) => l.name).join(", ")}</p>
              <div className="fw-stars-mini">{"★".repeat(Math.round(o.ratings.filter(Boolean).reduce((a, b) => a + b, 0) / (o.ratings.filter(Boolean).length || 1)) || 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const SERVICE_CHIPS = [
    { id: "sponge", Icon: Droplet }, { id: "gloves", Icon: SprayCan }, { id: "vacuum", Icon: Fan }, { id: "bucket", Icon: Wallet },
  ];
  const [chips, setChips] = useState(["sponge", "vacuum"]);

  const renderProfile = () => (
    <div className="fw-screen">
      <TopBar title="Perfil" />
      <div className="fw-center">
        <div className="fw-avatar fw-avatar--lg">
          <User size={30} />
          {editingProfile && <span className="fw-avatar-edit"><Pencil size={12} /></span>}
        </div>
        <div className="fw-chip-row">
          {SERVICE_CHIPS.map(({ id, Icon }) => (
            <button
              key={id}
              className={`fw-chip ${chips.includes(id) ? "is-active" : ""}`}
              onClick={() => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
            <button
            type="button"
            className="fw-logout-btn"
            onClick={logout}
            >
            Cerrar sesión
            </button>
      </div>

      <div className="fw-form">
        <input className="fw-input" disabled={!editingProfile} value={profile.nombre} onChange={(e) => setProfile({ ...profile, nombre: e.target.value })} placeholder="Nombre(s)" />
        <input className="fw-input" disabled={!editingProfile} value={profile.apellido} onChange={(e) => setProfile({ ...profile, apellido: e.target.value })} placeholder="Apellido(s)" />
        <input className="fw-input" disabled={!editingProfile} value={profile.telefono} onChange={(e) => setProfile({ ...profile, telefono: e.target.value })} placeholder="Teléfono" />
        <p className="fw-section-title" style={{ marginTop: 8 }}>Dirección 1</p>
        <div className="fw-cardform-row">
          <input className="fw-input" disabled={!editingProfile} value={profile.cp} onChange={(e) => setProfile({ ...profile, cp: e.target.value })} placeholder="C.P." />
          <input className="fw-input" disabled={!editingProfile} value={profile.colonia} onChange={(e) => setProfile({ ...profile, colonia: e.target.value })} placeholder="Colonia" />
        </div>
        <div className="fw-cardform-row">
          <input className="fw-input" disabled={!editingProfile} value={profile.calle} onChange={(e) => setProfile({ ...profile, calle: e.target.value })} placeholder="Calle" />
          <input className="fw-input" disabled={!editingProfile} value={profile.numero} onChange={(e) => setProfile({ ...profile, numero: e.target.value })} placeholder="No. exterior" />
        </div>
      </div>

      <PlaceMap label={`${profile.calle} ${profile.numero}`} />

      <div className="fw-profile-actions">
        <button className="fw-btn-outline" onClick={() => setEditingProfile((v) => !v)}>{editingProfile ? "Cancelar" : "Editar"}</button>
        <button className="fw-btn-primary" onClick={() => setEditingProfile(false)}>Guardar</button>
      </div>

      <button className="fw-teamlink" onClick={() => push("team")}>
        Ver equipo de limpieza disponible <ChevronLeft size={16} className="fw-rot-r" />
      </button>

      <button
        type="button"
        className="fw-teamlink"
        style={{ opacity: 0.6, fontSize: 12 }}
        onClick={async () => { if (window.confirm("¿Borrar solicitudes, mensajes y fotos de la demo en todos los dispositivos?")) { await resetDemo(); logout(); } }}
      >
        Reiniciar datos de la demo
      </button>
    </div>
  );

  const renderWallet = () => (
    <div className="fw-screen">
      <TopBar title="Monedero FlexiWash" />
      <div className="fw-wallet-card">
        <span>Saldo disponible</span>
        <strong>{money(walletBalance)}</strong>
        <p>Recibe 3% de recompensa al completar servicios elegibles.</p>
      </div>
      <section className="fw-section"><h3>Depositar desde tu tarjeta</h3>
        <div className="fw-card fwp-col">
          <input className="fw-input" inputMode="decimal" aria-label="Monto a depositar" placeholder="Monto (mínimo $200)" value={topup.monto}
            onChange={(e) => setTopup({ ...topup, monto: e.target.value.replace(/[^\d.]/g, "").replace(/^(\d*\.?\d{0,2}).*$/, "$1") })} />
          {topupShow && topupErr.monto && <p className="fw-field-err" role="alert">{topupErr.monto}</p>}
          <div className="fwp-chips">{[200, 500, 1000].map((v) => <button key={v} type="button" className={`fwp-chip ${+topup.monto === v ? "is-on" : ""}`} onClick={() => setTopup({ ...topup, monto: String(v) })}>{money(v)}</button>)}</div>
          <button type="button" className="fw-linklike" onClick={() => setTopup({ ...topup, ...testCard() })}>Usar tarjeta de prueba</button>
          <input className="fw-input" placeholder="Nombre del titular" autoComplete="cc-name" value={topup.nombre} onChange={(e) => setTopup({ ...topup, nombre: e.target.value })} />
          {topupShow && topupErr.nombre && <p className="fw-field-err" role="alert">{topupErr.nombre}</p>}
          <input className="fw-input" placeholder="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" value={topup.numero} onChange={(e) => setTopup({ ...topup, numero: formatCardNumber(e.target.value) })} />
          {topupShow && topupErr.numero && <p className="fw-field-err" role="alert">{topupErr.numero}</p>}
          <div className="fw-cardform-row">
            <input className="fw-input" placeholder="CVV" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={topup.cvv} onChange={(e) => setTopup({ ...topup, cvv: onlyDigits(e.target.value) })} />
            <input className="fw-input" placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" value={topup.exp} onChange={(e) => setTopup({ ...topup, exp: formatExp(e.target.value) })} />
          </div>
          {topupShow && (topupErr.exp || topupErr.cvv) && <p className="fw-field-err" role="alert">{topupErr.exp || topupErr.cvv}</p>}
          <button className="fw-btn-primary fw-btn-block" onClick={doTopup}>Depositar {topupAmount >= 200 ? money(topupAmount) : ""}</button>
        </div>
      </section>
      <section className="fw-section"><h3>Movimientos recientes</h3>
        <div className="fw-card">
          {walletTx.length === 0 ? <span>Aún no tienes depósitos.</span> : walletTx.map((t) => <div key={t.id} className="fw-order-line"><span>{t.label}<br /><small>{timeAgo(t.ts)}</small></span><strong>+{money(t.amount)}</strong></div>)}
          <div className="fw-order-line"><span>Recompensa de servicio</span><strong>+ 3%</strong></div>
        </div>
      </section>
    </div>
  );

  const renderServices = () => (
    <div className="fw-screen">
      <TopBar title="Servicios" />
      <div className="fw-service-grid">
        <button onClick={() => openCatalog("autos")}><Car/><strong>Lavado de autos</strong><span>Express, Básico, Intermedio y Premium</span></button>
        <button onClick={() => openCatalog("hogar")}><HomeIcon/><strong>Limpieza del hogar</strong><span>Básica, profunda, mudanza y áreas</span></button>
        <button onClick={() => openCatalog("muebles")}><Sofa/><strong>Limpieza de muebles</strong><span>Sofás, colchones, sillas y alfombras</span></button>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="fw-screen">
      <TopBar title="Equipo de limpieza" onBack={pop} />
      <div className="fw-team-list">
        {team.map((e) => (
          <button key={e.id} className="fw-employee-card" onClick={() => { setSelectedEmployee(e); push("employeeDetail"); }}>
            <div className="fw-avatar"><User size={20} /></div>
            <div>
              <strong>{e.name}</strong>
              <div className="fw-stars-mini">{"★".repeat(Math.round(e.rating))} <span className="fw-muted">{ratingText(e)}</span></div>
              <p className="fw-muted">{e.years ? `${yearsLabel(e.years)} · ` : ""}{serviceLabels(e).join(", ")}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const providerLogin = () => {
    const tel = onlyDigits(pl.tel);
    const found = registered.find((p) => p.verified && onlyDigits(p.telefono) === tel);
    if (found && found.pin === pl.pin) { setProviderMe(found.id); setPl({ tel: "", pin: "", err: "" }); return push("providerHome"); }
    if (!found && tel === TEAM[0].phone && pl.pin === DEMO_PIN) { setProviderMe(TEAM[0].id); setPl({ tel: "", pin: "", err: "" }); return push("providerHome"); }
    setPl((p) => ({ ...p, err: "Teléfono o PIN incorrectos." }));
  };
  const renderProviderLogin = () => (
    <div className="fw-screen">
      <TopBar title="Prestador FlexiWash" onBack={pop} />
      <div className="fw-provider-login">
        <img src={logoFlexiWash} alt="FlexiWash" className="fw-provider-logo" />
        <h2>Panel del prestador</h2>
        <p>Recibe solicitudes cercanas, administra tus servicios y consulta tus ganancias.</p>
        <input className="fw-input" placeholder="Teléfono (10 dígitos)" inputMode="numeric" value={pl.tel} onChange={(e) => setPl({ ...pl, tel: e.target.value, err: "" })} />
        <input className="fw-input" placeholder="PIN" type="password" inputMode="numeric" maxLength={6} value={pl.pin} onChange={(e) => setPl({ ...pl, pin: onlyDigits(e.target.value), err: "" })} />
        {pl.err && <p className="fw-field-err" role="alert">{pl.err}</p>}
        <button className="fw-btn-primary fw-btn-block" onClick={providerLogin}>Iniciar sesión</button>
        <button className="fw-btn-outline fw-btn-block" onClick={() => push("providerRegister")}>Registrarme como prestador</button>
        <p className="fw-muted" style={{ fontSize: 12 }}>Cuenta demo: 667 555 0142 · PIN 1234</p>
      </div>
    </div>
  );

  const screens = {
    login: renderLogin,
    loginPhone: () => renderLoginSub("loginPhone"),
    loginEmail: () => renderLoginSub("loginEmail"),
    loginFacebook: () => renderLoginSub("loginFacebook"),
    loginAccount: () => renderLoginSub("loginAccount"),
    providerLogin: renderProviderLogin,
    providerRegister: () => <ProviderRegister TopBar={TopBar} providers={registered} onBack={pop} onDone={(id) => { setProviderMe(id); setStack((st) => [...st.filter((x) => x !== "providerRegister"), "providerHome"]); }} />,
    providerHome: () => <ProviderPanel team={team} meId={providerMe} onExit={() => { setSession(false); setStack(["login"]); }} />,
    home: renderHome,
    services: renderServices,
    wallet: renderWallet,
    catalog: renderCatalog,
    summary: renderSummary,
    address: renderAddress,
    schedule: renderSchedule,
    providers: renderProviders,
    payment: renderPayment,
    confirmation: renderConfirmation,
    tracking: renderTracking,
    employeeDetail: renderEmployeeDetail,
    rating: renderRating,
    thanks: renderThanks,
    history: renderHistory,
    profile: renderProfile,
    team: renderTeam,
  };

  return (
    <div className="fw-app">
      <style>{CSS}</style>
      <div className="fw-shell">
        <StatusBar />
        {toast && (
          <button className="fw-toast" role="status" onClick={() => openNotif(toast)}>
            <Bell size={16} /><span><strong>{toast.title}</strong><br />{toast.text}</span>
          </button>
        )}
        <div className="fw-content">{(screens[screen] || renderHome)()}</div>
        {showNotifs && renderNotifSheet()}
        {chatReqId != null && <ChatView reqId={chatReqId} me="client" title={chatName} subtitle="Tu prestador" onClose={() => setComms(null)} />}
        {comms?.type === "call" && currentOrder && <CallView reqId={currentOrder.id} me="client" name={currentOrder.employee?.name} onClose={() => setComms(null)} />}
        {showBottomNav && <BottomNav active={activeTab} onChange={goTab} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Styles                                                                   */
/* ---------------------------------------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

:root{
  --fw-bg:#EFF7F5;
  --fw-surface:#FFFFFF;
  --fw-ink:#0F2A2E;
  --fw-ink-soft:#5B7570;
  --fw-teal:#0E9C8E;
  --fw-teal-dark:#0B7F74;
  --fw-auto:#E2542D;
  --fw-auto-dark:#C1431F;
  --fw-hogar:#2F5FA8;
  --fw-hogar-dark:#254C87;
  --fw-gold:#F0AE2E;
  --fw-success:#2E9E5B;
  --fw-error:#D64545;
  --fw-line:#DCEAE8;
}
*{box-sizing:border-box;}
.fw-app{
  font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;
  color:var(--fw-ink);
  min-height:100vh;
  background:
    radial-gradient(circle at 12% 8%, rgba(14,156,142,0.10), transparent 40%),
    radial-gradient(circle at 88% 92%, rgba(47,95,168,0.10), transparent 40%),
    var(--fw-bg);
  display:flex;
  justify-content:center;
}
.fw-app h1,.fw-app h2,.fw-app h3,.fw-app h4{font-family:inherit;}
.fw-app button,.fw-app input,.fw-app select,.fw-app textarea{font-family:inherit;}
.fw-shell{
  width:100%;
  max-width:430px;
  background:var(--fw-surface);
  min-height:100vh;
  display:flex;
  flex-direction:column;
  position:relative;
}
@media (min-width:641px){
  .fw-app{padding:36px 16px;align-items:center;}
  .fw-shell{min-height:850px;height:850px;border-radius:38px;box-shadow:0 30px 70px rgba(15,42,46,0.22);border:1px solid var(--fw-line);overflow:hidden;}
}
.fw-content{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
.fw-content::-webkit-scrollbar{width:0;}

.fw-statusbar{display:flex;justify-content:space-between;align-items:center;padding:10px 22px 4px;font-size:12px;font-weight:700;color:var(--fw-ink);flex-shrink:0;}
.fw-statusbar-icons{display:flex;gap:5px;align-items:center;}
.fw-signal,.fw-wifi{width:14px;height:10px;background:var(--fw-ink);border-radius:2px;opacity:.85;}
.fw-battery{width:20px;height:10px;border:1.4px solid var(--fw-ink);border-radius:2px;}

.fw-screen{display:flex;flex-direction:column;padding:14px 20px 24px;flex:1;gap:14px;}
.fw-screen--pad-bottom{padding-bottom:110px;}
.fw-center{align-items:center;text-align:center;gap:10px;}

.fw-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;}
.fw-topbar-left{display:flex;align-items:center;gap:8px;}
.fw-topbar-left h1{font-size:20px;margin:0;font-weight:600;}
.fw-icon-btn{width:36px;height:36px;border-radius:50%;border:1px solid var(--fw-line);background:var(--fw-surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--fw-ink);position:relative;flex-shrink:0;}
.fw-icon-btn--ghost{visibility:hidden;}
.fw-topbar-right{display:flex;gap:8px;}

.fw-login{justify-content:space-between;padding-top:26px;}
.fw-login-hero{text-align:center;padding:18px 4px;}
.fw-country{display:inline-block;background:#F1F1F1;border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;margin-bottom:18px;}
.fw-login-hero h1{font-size:26px;line-height:1.25;font-weight:600;color:var(--fw-teal-dark);margin:0 0 10px;}
.fw-login-hero em{font-style:normal;color:var(--fw-auto);}
.fw-login-hero p{font-size:12px;color:var(--fw-ink-soft);}
.fw-login-logo{
  display:block;
  width:280px;
  max-width:85%;
  height:auto;
  object-fit:contain;
  margin:0 auto 10px;
}
.fw-login-actions{display:flex;flex-direction:column;gap:12px;}
.fw-authbtn{display:flex;align-items:center;justify-content:center;gap:10px;border:none;border-radius:999px;padding:14px;font-weight:700;font-size:14.5px;cursor:pointer;color:#fff;}
.fw-authbtn--phone{background:var(--fw-success);}
.fw-authbtn--fb{background:#3B5A96;}
.fw-authbtn--mail{background:var(--fw-auto);}
.fw-authbtn--ghost{background:#EDEFEF;color:var(--fw-ink);}
.fw-login-foot{text-align:center;font-size:11px;color:var(--fw-ink-soft);}

.fw-provider-entry{display:flex;align-items:center;justify-content:center;gap:8px;background:none;border:none;color:var(--fw-teal-dark);font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;padding:6px;}
.fw-provider-login{display:flex;flex-direction:column;gap:14px;text-align:center;padding:30px 4px;}
.fw-provider-login h2{margin:0;font-size:25px}.fw-provider-login p{font-size:13px;color:var(--fw-ink-soft);margin:0 0 12px;line-height:1.5}.fw-provider-logo{width:150px;max-width:55%;height:auto;margin:0 auto 8px;}
.fw-provider-status{border:1px solid var(--fw-line);border-radius:16px;padding:14px;display:flex;justify-content:space-between;align-items:center}.fw-provider-status div{display:flex;flex-direction:column;gap:3px}.fw-provider-status span{font-size:11px;color:var(--fw-ink-soft)}
.fw-switch{width:48px;height:28px;border:none;border-radius:999px;background:#CCD7D5;padding:3px;cursor:pointer}.fw-switch span{display:block;width:22px;height:22px;border-radius:50%;background:#fff;transition:.2s}.fw-switch.is-on{background:var(--fw-success)}.fw-switch.is-on span{transform:translateX(20px)}
.fw-provider-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fw-provider-stats div{border:1px solid var(--fw-line);border-radius:14px;padding:12px 6px;text-align:center;display:flex;flex-direction:column;gap:3px}.fw-provider-stats strong{font-size:14px}.fw-provider-stats span{font-size:10px;color:var(--fw-ink-soft)}
.fw-provider-list{display:flex;flex-direction:column;gap:10px}.fw-provider-request{border:1px solid var(--fw-line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}.fw-provider-request.is-active{border-color:var(--fw-teal)}.fw-provider-request-head{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center}.fw-provider-request-head>div:nth-child(2){display:flex;flex-direction:column;gap:2px}.fw-provider-request-head small{color:var(--fw-teal-dark);font-weight:800}.fw-provider-request-head span{font-size:11px;color:var(--fw-ink-soft)}.fw-provider-request-head b{font-size:14px}.fw-provider-request-icon{width:42px;height:42px;border-radius:13px;background:#EAF5F3;color:var(--fw-teal-dark);display:flex;align-items:center;justify-content:center}.fw-provider-meta{display:flex;justify-content:space-between;font-size:11px;color:var(--fw-ink-soft)}.fw-provider-meta span{display:flex;align-items:center;gap:4px}.fw-provider-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fw-provider-progress{display:flex;justify-content:space-between;gap:4px}.fw-provider-progress span{font-size:9px;background:#EEF3F2;color:var(--fw-ink-soft);padding:5px 6px;border-radius:8px;flex:1;text-align:center}.fw-provider-progress span.is-done{background:#DDF3EC;color:var(--fw-success);font-weight:800}.fw-provider-earnings{width:100%;border:1px solid var(--fw-line);background:#fff;border-radius:14px;padding:13px;display:flex;align-items:center;gap:10px;color:var(--fw-ink);cursor:pointer}.fw-provider-earnings>span{display:flex;flex-direction:column;align-items:flex-start;flex:1}.fw-provider-earnings small{color:var(--fw-ink-soft);font-size:10px;margin-top:2px}

.fw-authform{display:flex;flex-direction:column;gap:14px;padding-top:14px;}
.fw-authform h2{font-size:22px;font-weight:600;margin:0;}
.fw-authform p{font-size:12px;color:var(--fw-ink-soft);margin:0 0 8px;}
.fw-fb-badge{display:flex;justify-content:center;padding:18px 0;}
.fw-phone-input{display:flex;align-items:center;gap:10px;border:1px solid var(--fw-line);border-radius:14px;padding:14px;}
.fw-phone-input input{border:none;outline:none;font-size:15px;flex:1;font-family:inherit;}
.fw-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.fw-slots--days{grid-template-columns:repeat(3,1fr)}
.fw-slot{border:1px solid var(--fw-line);background:var(--fw-surface);border-radius:12px;padding:11px 4px;font:inherit;font-size:12.5px;font-weight:700;color:var(--fw-ink);cursor:pointer;text-transform:capitalize}
.fw-slot.is-on{background:var(--fw-teal);border-color:var(--fw-teal);color:#fff}.fw-slot:disabled{opacity:.35;cursor:not-allowed}
.fw-pick.is-on{border-color:var(--fw-teal);box-shadow:0 0 0 2px var(--fw-teal) inset}
.fw-field-err{color:var(--fw-error);font-size:12px;margin:4px 2px 0}.fwp-col{display:flex;flex-direction:column;gap:10px}.fwp-label{font-size:12px;font-weight:700;color:var(--fw-ink-soft)}textarea.fw-input{resize:vertical}
.fw-input{border:1px solid var(--fw-line);border-radius:12px;padding:13px 14px;font-size:14px;font-family:inherit;width:100%;background:var(--fw-surface);color:var(--fw-ink);}
.fw-input:disabled{background:#F5F8F7;color:var(--fw-ink-soft);}
.fw-btn-primary{background:var(--fw-teal);color:#fff;border:none;border-radius:999px;padding:14px;font-weight:700;font-size:14.5px;cursor:pointer;}
.fw-btn-primary:disabled{background:#BFD9D5;cursor:not-allowed;}
.fw-btn-outline{background:transparent;border:1.5px solid var(--fw-teal);color:var(--fw-teal-dark);border-radius:999px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;}
.fw-btn-block{width:100%;}
.fw-linklike{background:none;border:none;color:var(--fw-ink-soft);text-decoration:underline;font-size:13px;cursor:pointer;font-family:inherit;}

.fw-home-top{display:flex;justify-content:space-between;align-items:center;}
.fw-addr{background:none;border:none;font-weight:700;font-size:14px;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--fw-ink);padding:0;}
.fw-rot{transform:rotate(-90deg);}
.fw-rot-r{transform:rotate(180deg);}
.fw-home-top-icons{display:flex;gap:8px;}
.fw-notif-wrap{position:relative;}
.fw-notif-panel{position:absolute;right:0;top:44px;width:230px;background:var(--fw-surface);border:1px solid var(--fw-line);border-radius:14px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.12);z-index:20;}
html,body{height:100%;margin:0;overflow:hidden;overscroll-behavior:none}
#root{height:100%}
.fw-app{height:100dvh;min-height:0;overflow:hidden}
.fw-shell{height:100dvh;min-height:0;overflow:hidden}
.fw-content{min-height:0;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.fw-content:has(.fw-login){overflow:hidden}
.fw-screen--pad-bottom{padding-bottom:24px}
@media (max-height:720px){.fw-login{padding-top:10px;gap:8px}.fw-login-hero{padding:6px 4px}.fw-login-logo{max-height:80px;width:auto}}
.fw-notif-panel{width:290px;max-height:340px;overflow-y:auto}
.fw-notif-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px}
.fw-notif-panel p.is-unread{background:var(--fw-teal-soft, #e6f4f3);border-radius:10px;padding:8px}
.fw-notif-panel small{color:var(--fw-ink-soft)}
.fw-toast{position:absolute;top:44px;left:12px;right:12px;z-index:60;display:flex;gap:10px;align-items:flex-start;text-align:left;font:inherit;font-size:12.5px;background:var(--fw-ink,#0f2a2e);color:#fff;border:none;border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25);cursor:pointer;animation:fwtoast .25s ease-out}
@keyframes fwtoast{from{transform:translateY(-12px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.fw-toast{animation:none}}
.fw-notif-panel p{font-size:12px;margin:0 0 8px;line-height:1.4;}
.fw-notif-panel p:last-child{margin:0;}
.fw-notif-item{display:block;width:100%;text-align:left;font:inherit;font-size:12px;line-height:1.4;color:inherit;background:transparent;border:none;border-radius:10px;padding:8px;margin:0 0 8px;cursor:pointer;}
.fw-notif-item.is-unread{background:var(--fw-teal-soft,#e6f4f3);}
.fw-notif-item:last-child{margin:0;}
.fw-notif-item small{color:var(--fw-ink-soft);}
.fw-notif-sheet{position:absolute;inset:0;z-index:70}
.fw-notif-back{position:absolute;inset:0;width:100%;border:none;background:rgba(15,42,46,.35);cursor:pointer}
.fw-notif-sheet .fw-notif-panel{top:56px;left:12px;right:12px;width:auto;max-height:calc(100% - 80px);padding:14px}
.fw-notif-tools{display:flex;gap:12px}
.fw-active{display:flex;flex-direction:column;gap:10px;padding:12px}
.fw-active-top{display:flex;gap:10px;align-items:center}.fw-active-top>div:last-child{display:flex;flex-direction:column;min-width:0;font-size:13px}.fw-active-top .fw-muted{font-size:12px}
.fw-active-actions{display:flex;gap:8px}.fw-active-actions>button{flex:1}
.fw-notif-cta{color:var(--fw-teal-dark);font-weight:800;font-size:11px;margin-left:6px;}
.fw-badge{position:absolute;top:-4px;right:-4px;background:var(--fw-auto);color:#fff;font-size:10px;font-weight:800;border-radius:50%;width:17px;height:17px;display:flex;align-items:center;justify-content:center;}

.fw-search{display:flex;align-items:center;gap:8px;background:#F1F6F5;border-radius:14px;padding:11px 14px;color:var(--fw-ink-soft);font-size:13.5px;}
.fw-section h3{font-size:14px;font-weight:800;margin:0 0 10px;}
.fw-section{display:flex;flex-direction:column;}
.fw-services-row{display:flex;gap:10px;}
.fw-service-tile{flex:1;background:var(--fw-surface);border:1px solid var(--fw-line);border-radius:16px;padding:14px 6px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;font-weight:700;color:var(--fw-ink);}
.fw-tile-icon{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;}
.fw-tile-icon--hogar{background:var(--fw-hogar);}
.fw-tile-icon--autos{background:var(--fw-auto);}
.fw-tile-icon--extras{background:var(--fw-teal);}

.fw-quick-row{display:flex;gap:10px;}
.fw-quick{--fw-q:var(--fw-teal);flex:1;aspect-ratio:1;border:none;border-radius:16px;background:var(--fw-q);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;}

.fw-promo{background:linear-gradient(120deg,var(--fw-gold),#F6C860);border-radius:16px;padding:16px;display:flex;justify-content:space-between;align-items:center;color:#4A3305;}
.fw-promo strong{font-size:14px;}
.fw-promo p{font-size:12px;margin:4px 0 0;}

.fw-map-link{border:none;background:none;padding:0;cursor:pointer;width:100%;}

.fw-segmented{display:flex;background:#F1F6F5;border-radius:12px;padding:4px;gap:4px;}
.fw-seg{flex:1;border:none;background:transparent;border-radius:9px;padding:9px 4px;font-size:12.5px;font-weight:700;color:var(--fw-ink-soft);cursor:pointer;}
.fw-seg.is-active{background:var(--fw-surface);color:var(--fw-ink);box-shadow:0 2px 6px rgba(0,0,0,.08);}

.fw-catalog-hero{border-radius:16px;height:64px;display:flex;align-items:center;justify-content:center;color:#fff;}
.fw-catalog-hero--auto{background:linear-gradient(120deg,var(--fw-auto),var(--fw-auto-dark));}
.fw-catalog-hero--hogar{background:linear-gradient(120deg,var(--fw-hogar),var(--fw-hogar-dark));}
.fw-catalog-hero--extras{background:linear-gradient(120deg,var(--fw-teal),var(--fw-teal-dark));}

.fw-catalog-list{display:flex;flex-direction:column;gap:10px;}
.fw-catalog-item{display:flex;gap:10px;border:1px solid var(--fw-line);border-radius:14px;padding:12px;align-items:flex-start;}
.fw-catalog-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}
.fw-catalog-icon--auto{background:var(--fw-auto);}
.fw-catalog-icon--hogar{background:var(--fw-hogar);}
.fw-catalog-icon--extras{background:var(--fw-teal);}
.fw-catalog-info{flex:1;min-width:0;}
.fw-catalog-name{font-weight:700;font-size:13.5px;}
.fw-catalog-desc{font-size:11.5px;color:var(--fw-ink-soft);margin:2px 0 4px;}
.fw-catalog-price{font-size:12px;font-weight:700;color:var(--fw-teal-dark);}
.fw-select{margin-top:6px;font-size:11.5px;border:1px solid var(--fw-line);border-radius:8px;padding:4px 6px;font-family:inherit;}
.fw-opts{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:6px;}
.fw-opt{display:flex;flex-direction:column;gap:2px;font-size:10.5px;font-weight:700;color:var(--fw-ink-soft);max-width:100%;}
.fw-opt .fw-select{margin-top:0;max-width:100%;}
.fw-areas{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;}
.fw-area{display:flex;align-items:center;justify-content:space-between;gap:6px;border:1px solid var(--fw-line);border-radius:10px;padding:5px 8px;font-size:11.5px;min-width:0;}
.fw-area.is-on{border-color:var(--fw-hogar);background:#F1F6FD;font-weight:700;}
.fw-area-ctl{display:flex;align-items:center;gap:5px;flex-shrink:0;}
.fw-area-ctl button{width:18px;height:18px;border-radius:50%;border:none;background:#E7EEF8;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--fw-ink);padding:0;}
.fw-area-ctl button:disabled{opacity:.35;cursor:not-allowed;}
.fw-area-ctl b{min-width:10px;text-align:center;font-size:12px;}
.fw-stepper{display:flex;align-items:center;gap:8px;border:1px solid var(--fw-line);border-radius:999px;padding:4px 8px;flex-shrink:0;}
.fw-stepper button{width:20px;height:20px;border-radius:50%;border:none;background:#F1F6F5;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--fw-ink);}
.fw-stepper button:disabled{opacity:.4;cursor:not-allowed;}
.fw-stepper span{font-weight:800;font-size:13px;min-width:14px;text-align:center;}

.fw-summary-bar{position:sticky;bottom:0;background:var(--fw-surface);border-top:1px solid var(--fw-line);padding:12px 20px 18px;margin:0 -20px;display:flex;flex-direction:column;gap:10px;}
.fw-summary-rows > div{display:flex;justify-content:space-between;font-size:12.5px;color:var(--fw-ink-soft);padding:2px 0;}
.fw-summary-total{font-weight:800;color:var(--fw-ink) !important;font-size:15px !important;border-top:1px dashed var(--fw-line);padding-top:6px !important;margin-top:2px;}

.fw-paylist{display:flex;flex-direction:column;gap:10px;}
.fw-payopt{border:1px solid var(--fw-line);border-radius:14px;overflow:hidden;}
.fw-payopt.is-active{border-color:var(--fw-teal);}
.fw-payopt-head{width:100%;display:flex;align-items:center;gap:10px;background:none;border:none;padding:14px;font-size:14px;font-weight:700;cursor:pointer;color:var(--fw-ink);}
.fw-radio{width:18px;height:18px;border-radius:50%;border:2px solid var(--fw-line);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.fw-payopt.is-active .fw-radio{border-color:var(--fw-teal);}
.fw-radio span{width:10px;height:10px;border-radius:50%;background:var(--fw-teal);}
.fw-cardform{padding:0 14px 14px;display:flex;flex-direction:column;gap:8px;}
.fw-cardform-row{display:flex;gap:8px;}
.fw-checkline{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--fw-ink-soft);margin-top:2px;}

.fw-modal-veil{position:absolute;inset:0;background:rgba(15,42,46,.45);display:flex;align-items:center;justify-content:center;z-index:50;border-radius:inherit;}
.fw-modal{background:var(--fw-surface);border-radius:18px;padding:26px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;width:78%;}
.fw-modal p{font-size:13px;color:var(--fw-ink-soft);margin:0 0 8px;}

.fw-confirm-icon{width:80px;height:80px;border-radius:50%;background:var(--fw-success);display:flex;align-items:center;justify-content:center;margin-top:20px;}
.fw-order-summary{width:100%;text-align:left;display:flex;flex-direction:column;gap:6px;}
.fw-order-line{display:flex;justify-content:space-between;font-size:12.5px;}
.fw-card{background:var(--fw-surface);border:1px solid var(--fw-line);border-radius:14px;padding:14px;font-size:12.5px;color:var(--fw-ink-soft);}

.fw-steps{display:flex;justify-content:space-between;}
.fw-step{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;position:relative;font-size:10.5px;color:var(--fw-ink-soft);text-align:center;}
.fw-step-dot{width:12px;height:12px;border-radius:50%;background:var(--fw-line);}
.fw-step.is-done .fw-step-dot{background:var(--fw-teal);}
.fw-step.is-done{color:var(--fw-ink);font-weight:700;}
.fw-section-title{font-size:13px;font-weight:800;margin:6px 0 2px;}
.fw-employee-card{display:flex;align-items:center;gap:12px;border:1px solid var(--fw-line);border-radius:14px;padding:12px;background:var(--fw-surface);cursor:pointer;width:100%;text-align:left;}
.fw-employee-card > div:nth-child(2){flex:1;}
.fw-avatar{width:40px;height:40px;border-radius:50%;background:#DCEAE8;display:flex;align-items:center;justify-content:center;color:var(--fw-teal-dark);flex-shrink:0;position:relative;}
.fw-avatar--lg{width:76px;height:76px;}
.fw-avatar-edit{position:absolute;bottom:0;right:0;background:var(--fw-teal);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;}
.fw-stars-mini{color:var(--fw-gold);font-size:12px;letter-spacing:1px;}
.fw-cam-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.fw-cam{aspect-ratio:4/3;background:repeating-linear-gradient(0deg,#3a3a3a,#3a3a3a 2px,#454545 2px,#454545 4px);border-radius:10px;position:relative;display:flex;align-items:center;justify-content:center;color:#cfcfcf;}
.fw-cam--img{overflow:hidden;background:#000;padding:0}.fw-cam--img img{width:100%;height:100%;object-fit:cover;display:block}
.fw-cam-label{position:absolute;top:6px;left:6px;background:var(--fw-hogar-dark);color:#fff;font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:5px;}

.fw-rating-list{display:flex;flex-direction:column;gap:14px;}
.fw-rating-item p{font-size:12.5px;font-weight:600;margin:0 0 6px;}
.fw-starrow{display:flex;gap:4px;}
.fw-starrow button{background:none;border:none;padding:0;cursor:pointer;}
.fw-textarea{border:1px solid var(--fw-line);border-radius:14px;padding:12px;font-family:inherit;font-size:13px;min-height:80px;resize:none;}

.fw-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--fw-ink-soft);text-align:center;padding:40px 20px;}
.fw-empty p{font-weight:700;color:var(--fw-ink);margin:6px 0 0;}
.fw-empty span{font-size:12px;}
.fw-history-list{display:flex;flex-direction:column;gap:10px;}
.fw-history-item-top{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:4px;}
.fw-muted{color:var(--fw-ink-soft);font-size:12px;}

.fw-chip-row{display:flex;gap:8px;margin-top:10px;}
.fw-chip{width:32px;height:32px;border-radius:50%;border:1.5px solid var(--fw-line);background:var(--fw-surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--fw-ink-soft);}
.fw-chip.is-active{background:var(--fw-teal);border-color:var(--fw-teal);color:#fff;}
.fw-form{display:flex;flex-direction:column;gap:8px;}
.fw-profile-actions{display:flex;gap:10px;}
.fw-profile-actions button{flex:1;}
.fw-teamlink{background:none;border:none;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--fw-teal-dark);font-weight:700;font-size:13px;padding:10px;cursor:pointer;font-family:inherit;}
.fw-verify-row{display:flex;justify-content:space-between;gap:8px;}
.fw-verify-row > div{flex:1;border:1px solid var(--fw-line);border-radius:12px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10.5px;text-align:center;color:var(--fw-ink-soft);}
.fw-team-list{display:flex;flex-direction:column;gap:10px;}

.fw-bottomnav{display:flex;border-top:1px solid var(--fw-line);padding:8px 10px calc(env(safe-area-inset-bottom,0) + 8px);flex-shrink:0;background:var(--fw-surface);}
.fw-navitem{flex:1;background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;color:var(--fw-ink-soft);cursor:pointer;padding:4px;font-family:inherit;}
.fw-navitem.is-active{color:var(--fw-teal-dark);font-weight:700;}
.fw-tile-icon--muebles{background:#7A5AA6;}
.fw-catalog-hero--muebles{background:linear-gradient(135deg,#8A6AB7,#68458F);}
.fw-catalog-icon--muebles{background:#7A5AA6;}
.fw-services-row--4{grid-template-columns:repeat(4,1fr)!important;}
.fw-wallet-card{background:linear-gradient(135deg,var(--fw-teal-dark),var(--fw-teal));color:#fff;border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:8px;}
.fw-wallet-card>span{font-size:12px;opacity:.85}.fw-wallet-card>strong{font-size:32px}.fw-wallet-card p{font-size:11.5px;margin:0 0 8px;opacity:.9}.fw-btn-light{border:0;background:#fff;color:var(--fw-teal-dark);font-weight:800;border-radius:12px;padding:11px;cursor:pointer;}
.fw-service-grid{display:grid;gap:12px}.fw-service-grid button{border:1px solid var(--fw-line);background:#fff;border-radius:16px;padding:18px;text-align:left;display:grid;grid-template-columns:34px 1fr;column-gap:10px;row-gap:3px;color:var(--fw-ink);cursor:pointer}.fw-service-grid button svg{grid-row:1/3;color:var(--fw-teal-dark)}.fw-service-grid button span{font-size:11.5px;color:var(--fw-ink-soft)}

.fw-logout-btn{
  width:100%;
  margin-top:20px;
  padding:14px 18px;

  border:1.5px solid var(--fw-error);
  border-radius:14px;

  background:#FFFFFF;
  color:var(--fw-error);

  font-family:inherit;
  font-size:14px;
  font-weight:700;

  cursor:pointer;
  transition:all .2s ease;
}

.fw-logout-btn:hover{
  background:#FFF3F3;
}

.fw-logout-btn:active{
  transform:scale(.98);
}

`;
