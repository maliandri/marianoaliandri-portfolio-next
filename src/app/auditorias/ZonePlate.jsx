import s from './auditorias.module.css';
import { formatCoord } from '@/lib/auditSummary';

// Plano estático de la zona auditada: tiles de OpenStreetMap posicionados en % sobre
// un contenedor 4:3 (calculado server-side en mapPlate()), en escala de grises por
// CSS para que combine con ambos temas, y los negocios como puntos coloreados por
// rango de Score SEO. Sin JS, sin API key, tiles con loading="lazy".
export default function ZonePlate({ plate, radioKm, label }) {
  if (!plate) {
    return <div className={s.plateCell} aria-hidden="true" />;
  }
  return (
    <div className={s.plateCell} role="img" aria-label={`Mapa de ${label} con los negocios auditados`}>
      <div className={s.plate}>
        {plate.tiles.map(t => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.src}
            src={t.src}
            alt=""
            loading="lazy"
            decoding="async"
            width={256}
            height={256}
            className={s.tile}
            style={{ left: `${t.left}%`, top: `${t.top}%`, width: `${plate.tileW}%`, height: `${plate.tileH}%` }}
          />
        ))}
        {plate.ring && (
          <span
            className={s.ring}
            style={{ left: `${plate.ring.x}%`, top: `${plate.ring.y}%`, width: `${plate.ring.w}%`, height: `${plate.ring.h}%` }}
          />
        )}
        {plate.points.map((p, i) => (
          <span
            key={i}
            className={s.dot}
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.bucket ? `var(--score-${p.bucket})` : 'var(--ink-3)' }}
          />
        ))}
      </div>
      <div className={`${s.plateLabel} ${s.mono}`}>
        <span>
          {formatCoord(plate.center.lat, plate.center.lon)}
          {radioKm ? <> · radio {radioKm} km</> : null}
        </span>
        <span className={s.attrib}>© OpenStreetMap</span>
      </div>
    </div>
  );
}
