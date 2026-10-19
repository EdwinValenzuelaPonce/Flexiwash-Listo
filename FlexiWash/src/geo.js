import { useEffect, useState } from "react";

// Centro por defecto del mapa (Culiacán, Sin.) cuando aún no hay ubicación del dispositivo.
export const DEFAULT_CENTER = [24.8091, -107.394];

// Distancia en km entre dos puntos { lat, lng } (fórmula de Haversine).
export const distKm = (a, b) => {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Ubicación real del dispositivo (navigator.geolocation). status: idle | loading | ok | denied | unavailable | unsupported | insecure.
// La geolocalización del navegador solo funciona en HTTPS o localhost: en http://192.168.x.x (modo servidor local) el celular la bloquea.
export function useGeolocation(enabled = true) {
  const [state, setState] = useState({ pos: null, status: enabled ? "loading" : "idle" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState((s) => ({ ...s, status: "unsupported" })); return undefined; }
    if (typeof window !== "undefined" && window.isSecureContext === false) { setState((s) => ({ ...s, status: "insecure" })); return undefined; }
    setState((s) => ({ ...s, status: s.pos ? "ok" : "loading" }));
    const id = navigator.geolocation.watchPosition(
      (p) => setState({ pos: { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }, status: "ok" }),
      (e) => setState((s) => ({ ...s, status: e.code === 1 ? "denied" : "unavailable" })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, nonce]);
  return { ...state, retry: () => setNonce((n) => n + 1) };
}

export const GEO_MESSAGES = {
  loading: "Obteniendo tu ubicación…",
  denied: "Permiso de ubicación denegado. Actívalo en los ajustes del navegador.",
  unavailable: "No pudimos obtener tu ubicación. Revisa el GPS e inténtalo de nuevo.",
  unsupported: "Este dispositivo no admite geolocalización.",
  insecure: "El navegador solo permite la ubicación en páginas HTTPS (o localhost).",
};
