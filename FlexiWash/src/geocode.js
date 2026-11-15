// Ubicación de direcciones: convierte una dirección escrita a coordenadas (y al revés) con OpenStreetMap Nominatim,
// y obtiene la ubicación actual del dispositivo. Nominatim es gratuito pero con límite de uso (≈1 consulta/seg):
// para producción conviene un geocodificador propio o de pago (Google, Mapbox…).
const NOM = "https://nominatim.openstreetmap.org";

export const addrLine = (a) => (a ? [a.street, a.colonia, a.cp && `CP ${a.cp}`].filter(Boolean).join(", ") : "");

const getJson = async (path) => {
  const r = await fetch(`${NOM}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

// Dirección escrita → { lat, lng } o null si no se encontró (o no hubo red).
export async function geocodeAddress({ street = "", colonia = "", cp = "" }) {
  const s = street.trim();
  const m = s.match(/^(.*?)[\s,]+(\d+\s?[A-Za-z]?)$/); // "Río Tamazula 145" → "145 Río Tamazula" (así lo entiende mejor Nominatim)
  const streets = m ? [`${m[2]} ${m[1]}`, s] : [s];
  const tail = "Culiacán, Sinaloa, México";
  const queries = [];
  streets.forEach((x) => queries.push(`${x}, ${colonia}, ${cp}, ${tail}`, `${x}, ${colonia}, ${tail}`));
  queries.push(`${streets[streets.length - 1]}, ${tail}`);
  for (const q of queries) {
    try {
      const j = await getJson(`/search?format=jsonv2&limit=1&countrycodes=mx&accept-language=es&q=${encodeURIComponent(q)}`);
      if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon };
    } catch { return null; }
    await new Promise((r) => setTimeout(r, 1100)); // respeta el límite de Nominatim
  }
  return null;
}

// Coordenadas → { calle, numero, colonia, cp } (campos vacíos si no se pudo).
export async function reverseGeocode({ lat, lng }) {
  try {
    const j = await getJson(`/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`);
    const a = j.address || {};
    return { calle: a.road || a.pedestrian || "", numero: a.house_number || "", colonia: a.suburb || a.neighbourhood || a.quarter || "", cp: /^\d{5}$/.test(a.postcode || "") ? a.postcode : "" };
  } catch { return { calle: "", numero: "", colonia: "", cp: "" }; }
}

// Ubicación actual del dispositivo (una lectura). Rechaza con un mensaje en español.
export const currentPosition = () => new Promise((resolve, reject) => {
  if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("Este dispositivo no admite geolocalización."));
  if (typeof window !== "undefined" && window.isSecureContext === false) return reject(new Error("El navegador solo permite la ubicación en páginas HTTPS (o localhost)."));
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
    (e) => reject(new Error(e.code === 1 ? "Permiso de ubicación denegado. Actívalo en los ajustes del navegador." : "No pudimos obtener tu ubicación. Revisa el GPS e inténtalo de nuevo.")),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
  );
});

// Dirección armada con la ubicación actual: { label, calle, numero, street, colonia, cp, ref, lat, lng, gps: true }.
export async function locateAddress() {
  const pos = await currentPosition();
  const g = await reverseGeocode(pos);
  return { label: "Ubicación actual", ...g, street: `${g.calle} ${g.numero}`.trim() || "Mi ubicación actual", ref: "", lat: pos.lat, lng: pos.lng, gps: true };
}

// ¿Cómo se ubica al cliente en el mapa para esta dirección?
//  - gps: ubicación en vivo del dispositivo · fixed: coordenadas de la dirección escrita
//  - dirección escrita sin coordenadas (no se pudo geocodificar): sin marcador · dirección vieja sin datos: GPS (como antes)
// Solo las direcciones tomadas con «Usar mi ubicación actual» (gps) siguen al GPS del dispositivo.
// Una dirección ESCRITA nunca usa el GPS: si aún no tiene coordenadas, no hay marcador (se ubica en segundo plano).
export const locOf = (a) => {
  if (!a || a.gps) return { useGps: true, target: null };
  return { useGps: false, target: a.lat != null ? { lat: a.lat, lng: a.lng } : null };
};

// Enlace «Cómo llegar» (Google Maps) hacia la dirección del servicio: con coordenadas si las hay; si no, con el texto escrito.
export const mapsUrl = (a, dest = null) => {
  const q = dest ? `${dest.lat},${dest.lng}` : a && !a.gps && a.street ? `${addrLine(a)}, Culiacán, Sinaloa, México` : "";
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : "";
};
