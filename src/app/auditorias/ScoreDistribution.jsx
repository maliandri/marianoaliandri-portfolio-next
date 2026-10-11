'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import s from './auditorias.module.css';

// Barra apilada al 100% (Recharts) + leyenda-tabla con % y cantidad por rango de Score SEO.
// Recibe solo los conteos ya agregados — nunca datos por negocio.
const plural = n => (n === 1 ? 'negocio' : 'negocios');

const FILL_CLASS = { '100': s.fill100, '80': s.fill80, '50': s.fill50, '0': s.fill0 };

function SegmentTooltip({ active, payload, buckets }) {
  if (!active || !payload?.length) return null;
  const b = buckets.find(x => x.key === payload[0].dataKey);
  if (!b) return null;
  return (
    <div className={`${s.tooltip} ${s.mono}`}>
      <span className={s.swatch} style={{ background: `var(--score-${b.key})` }} />
      Score {b.label}: <b>{b.pct}%</b> · {b.n} {plural(b.n)}
    </div>
  );
}

export default function ScoreDistribution({ buckets, total, size = 'sm' }) {
  const summary = buckets.map(b => `${b.label}: ${b.pct}% (${b.n} ${plural(b.n)})`).join('; ');
  const height = size === 'lg' ? 18 : 10;
  const row = Object.fromEntries(buckets.map(b => [b.key, b.n]));
  const visible = buckets.filter(b => b.n > 0);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Distribución del Score SEO de {total} {plural(total)}: {summary}.
      </figcaption>
      <div className={s.chart} style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis type="category" hide />
            <Tooltip
              cursor={false}
              shared={false}
              content={<SegmentTooltip buckets={buckets} />}
              wrapperStyle={{ zIndex: 20 }}
              allowEscapeViewBox={{ x: false, y: true }}
              position={{ y: -38 }}
            />
            {visible.map((b, i) => (
              <Bar
                key={b.key}
                dataKey={b.key}
                stackId="score"
                className={FILL_CLASS[b.key]}
                isAnimationActive
                animationDuration={600}
                radius={
                  visible.length === 1 ? 3
                    : i === 0 ? [3, 0, 0, 3]
                    : i === visible.length - 1 ? [0, 3, 3, 0]
                    : 0
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className={`${s.legend} ${size === 'lg' ? s.legendWide : ''} list-none p-0`} aria-hidden="true">
        {buckets.map(b => (
          <li key={b.key} className={`${s.legendRow} ${b.n === 0 ? s.empty : ''}`}>
            <span className={s.swatch} style={{ background: `var(--score-${b.key})` }} />
            <span className={`${s.range} ${s.mono}`}>{b.label}</span>
            <span className={`${s.value} ${s.mono}`}>
              <b>{b.pct}%</b> · {b.n} {plural(b.n)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
