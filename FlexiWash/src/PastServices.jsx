import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge, serviceBadge } from "./badges.jsx";

// Servicios anteriores de un prestador, visibles para el cliente: calificación + insignia, comentario y fotos.
// Solo aparecen servicios ya calificados (así hay comentario y las fotos ya no cambian).
const PAGE = 4;
const when = (ts) => new Date(ts).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

export default function PastServices({ providerId, ratings, photos, requests }) {
  const [shown, setShown] = useState(PAGE);
  const [zoom, setZoom] = useState(null);
  const items = useMemo(() => ratings
    .filter((r) => r.providerId === providerId)
    .sort((a, b) => b.ts - a.ts)
    .map((r) => {
      const req = requests.find((q) => q.id === r.reqId);
      return {
        ...r,
        title: req?.service || r.service || "Servicio",
        category: req?.category || r.category || "",
        pics: photos.filter((p) => p.reqId === r.reqId).sort((a, b) => a.ts - b.ts),
      };
    }), [providerId, ratings, photos, requests]);

  if (!items.length) return <div className="fw-card">Aún no tiene servicios calificados.</div>;
  return (
    <>
      <style>{`.fwh-it{display:flex;flex-direction:column;gap:6px}.fwh-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.fwh-top strong{font-size:13px;color:var(--fw-ink,#14302c)}.fwh-pics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.fwh-pics button{padding:0;border:0;border-radius:8px;overflow:hidden;aspect-ratio:1;cursor:pointer;background:#e6eeee}.fwh-pics img{width:100%;height:100%;object-fit:cover;display:block}.fwh-zoom{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px}.fwh-zoom img{max-width:100%;max-height:100%;border-radius:10px}.fwh-zoom button{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:0;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}`}</style>
      {items.slice(0, shown).map((it) => (
        <div key={it.reqId} className="fw-card fwh-it">
          <div className="fwh-top">
            <div>
              <strong>{it.title}</strong>
              <div className="fw-muted" style={{ fontSize: 11 }}>{it.category ? `${it.category} · ` : ""}{when(it.ts)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="fw-stars-mini">{"★".repeat(Math.round(it.avg))}{"☆".repeat(5 - Math.round(it.avg))}</div>
              <Badge b={serviceBadge(it.avg)} size={10} />
            </div>
          </div>
          {it.comment ? <p style={{ margin: 0 }}>“{it.comment}”</p> : <p className="fw-muted" style={{ margin: 0 }}>Sin comentario.</p>}
          {it.pics.length > 0 && (
            <div className="fwh-pics">
              {it.pics.slice(0, 4).map((p, i) => (
                <button key={p.id} onClick={() => setZoom(p.url)} aria-label={`Ver foto ${i + 1} del servicio`}><img src={p.url} alt={`Foto ${i + 1} de ${it.title}`} loading="lazy" /></button>
              ))}
            </div>
          )}
        </div>
      ))}
      {items.length > shown && <button className="fw-btn-outline fw-btn-block" onClick={() => setShown((n) => n + PAGE)}>Ver más servicios ({items.length - shown})</button>}
      {zoom && <div className="fwh-zoom" role="dialog" aria-label="Foto del servicio" onClick={() => setZoom(null)}><button aria-label="Cerrar foto" onClick={() => setZoom(null)}><X size={18} /></button><img src={zoom} alt="Foto del servicio ampliada" /></div>}
    </>
  );
}

// Vista previa compacta para la pantalla "Elige tu prestador": últimos comentarios y fotos, antes de contratar.
export function ProviderPreview({ providerId, ratings, photos, onOpen }) {
  const mine = ratings.filter((r) => r.providerId === providerId).sort((a, b) => b.ts - a.ts);
  if (!mine.length) return <p className="fw-muted" style={{ margin: "4px 4px 0", fontSize: 11.5 }}>Aún sin reseñas de clientes.</p>;
  const comments = mine.filter((r) => r.comment).slice(0, 2);
  const pics = mine.flatMap((r) => photos.filter((p) => p.reqId === r.reqId).sort((a, b) => a.ts - b.ts)).slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "6px 4px 0" }}>
      <style>{`.fwv-c{margin:0;font-size:12px;color:var(--fw-ink-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.fwv-p{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.fwv-p button{padding:0;border:0;border-radius:8px;overflow:hidden;aspect-ratio:1;cursor:pointer;background:#e6eeee}.fwv-p img{width:100%;height:100%;object-fit:cover;display:block}`}</style>
      {comments.map((r) => <p key={r.reqId} className="fwv-c"><span className="fw-stars-mini">{"★".repeat(Math.round(r.avg))}</span> “{r.comment}”</p>)}
      {pics.length > 0 && <div className="fwv-p">{pics.map((p, i) => <button key={p.id} onClick={onOpen} aria-label={`Ver foto ${i + 1} de servicios anteriores`}><img src={p.url} alt={`Servicio anterior ${i + 1}`} loading="lazy" /></button>)}</div>}
      <button className="fw-linklike" style={{ alignSelf: "flex-start" }} onClick={onOpen}>Ver las {mine.length} reseñas y fotos ›</button>
    </div>
  );
}
