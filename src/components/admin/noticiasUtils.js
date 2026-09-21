// Helpers de las vistas del bot de noticias (admin). Sin dependencias: se calculan sobre
// el log que ya devuelve GET /api/noticias, así no suman requests ni lecturas extra.

const TZ = 'America/Argentina/Buenos_Aires';

export const DESTINO_LABEL = {
  fb_ig: 'FB + IG',
  linkedin: 'LinkedIn',
  todas: 'FB + IG + LinkedIn',
  x: 'X',
};

// 'YYYY-MM-DD' en hora de Argentina (el tope diario del bot también cuenta por día argentino).
export function dayKey(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '—';
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export function hasProblem(n) {
  return n.status === 'error' || Boolean(n.makeError);
}

// Resumen de actividad a partir del log: hoy, últimos 7 días (por día), errores y destinos.
export function summarize(log, now = Date.now()) {
  const today = dayKey(new Date(now).toISOString());
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(dayKey(new Date(now - i * 86400000).toISOString()));
  const perDay = Object.fromEntries(days.map(d => [d, 0]));
  const porDestino = {};
  let publishedToday = 0;
  let errors7d = 0;
  for (const n of log) {
    const k = dayKey(n.publishedAt);
    if (!(k in perDay)) continue;
    if (n.status === 'published') {
      perDay[k] += 1;
      if (k === today) publishedToday += 1;
      const d = n.destino || 'fb_ig';
      porDestino[d] = (porDestino[d] || 0) + 1;
    }
    if (hasProblem(n)) errors7d += 1;
  }
  const attention = log.filter(n => hasProblem(n) && now - new Date(n.publishedAt || 0).getTime() < 48 * 3600000);
  return {
    publishedToday,
    perDay: days.map(d => ({ day: d, count: perDay[d] })),
    total7d: Object.values(perDay).reduce((a, b) => a + b, 0),
    errors7d,
    porDestino,
    attention,
    lastPublishedAt: log.find(n => n.status === 'published')?.publishedAt || null,
  };
}
