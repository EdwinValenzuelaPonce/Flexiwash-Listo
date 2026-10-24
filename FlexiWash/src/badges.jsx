import React from "react";
import { Award, Clock, Sparkles, Smile, Star, ShieldCheck, Sprout, Trophy } from "lucide-react";

// Insignias de FlexiWash.
//  - serviceBadge(avg): insignia de UN servicio según el promedio de su calificación.
//  - providerBadges(m, ratings): insignias de un prestador según sus calificaciones acumuladas.
// Los umbrales están en las constantes de abajo para ajustarlos fácilmente.
const MIN_REVIEWS_Q = 2; // reseñas mínimas para otorgar una insignia por pregunta (puntual, amable, impecable)

export function serviceBadge(avg) {
  if (!avg) return null;
  if (avg >= 4.8) return { id: "excelente", label: "Servicio excelente", color: "#8A5A00", bg: "#FFF1CC", Icon: Trophy };
  if (avg >= 4) return { id: "muybueno", label: "Muy buen servicio", color: "#0B6F65", bg: "#DDF3EF", Icon: Award };
  if (avg >= 3) return { id: "bueno", label: "Buen servicio", color: "#3F5A66", bg: "#E6EEF1", Icon: Star };
  return { id: "mejorable", label: "Por mejorar", color: "#9A3B3B", bg: "#FBE4E4", Icon: Star };
}

// Promedio de la pregunta i (índices de RATING_QUESTIONS en App.jsx: 0 calidad, 1 puntualidad, 2 amabilidad, 3 expectativas, 4 tiempo de respuesta)
const avgQ = (list, i) => {
  const v = list.map((r) => r.answers?.[i]).filter((x) => x > 0);
  return v.length >= MIN_REVIEWS_Q ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};

export function providerBadges(m, allRatings = []) {
  const mine = allRatings.filter((r) => r.providerId === m.id);
  const out = [];
  const verified = m.registered ? m.idStatus === "verified" : true; // el equipo base ya viene verificado
  if (verified) out.push({ id: "verificado", label: "Identidad verificada", color: "#0B6F65", bg: "#DDF3EF", Icon: ShieldCheck });
  if (!m.reviews) { out.push({ id: "nuevo", label: "Nuevo", color: "#3F5A66", bg: "#E6EEF1", Icon: Sprout }); return out; }
  if (m.reviews >= 5 && m.rating >= 4.8) out.push({ id: "top", label: "Top calificado", color: "#8A5A00", bg: "#FFF1CC", Icon: Trophy });
  if (avgQ(mine, 1) >= 4.5) out.push({ id: "puntual", label: "Puntual", color: "#0B6F65", bg: "#DDF3EF", Icon: Clock });
  if (avgQ(mine, 2) >= 4.5) out.push({ id: "amable", label: "Amable", color: "#7A3E8E", bg: "#F1E3F6", Icon: Smile });
  if (avgQ(mine, 0) >= 4.7) out.push({ id: "impecable", label: "Impecable", color: "#8A5A00", bg: "#FFF1CC", Icon: Sparkles });
  if (m.reviews >= 10) out.push({ id: "trayectoria", label: "+10 servicios", color: "#3F5A66", bg: "#E6EEF1", Icon: Award });
  return out;
}

export function Badge({ b, size = 11 }) {
  if (!b) return null;
  const { Icon } = b;
  return (
    <span title={b.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: b.bg, color: b.color, borderRadius: 999, padding: "3px 9px", fontSize: size, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap" }}>
      <Icon size={size + 1} aria-hidden="true" />{b.label}
    </span>
  );
}

export const BadgeRow = ({ badges, max }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
    {(max ? badges.slice(0, max) : badges).map((b) => <Badge key={b.id} b={b} />)}
  </div>
);
