// Lógica pura de la auditoría automática (sin I/O) — ver
// docs/superpowers/specs/2026-10-08-auditoria-automatica-design.md
import { auditReportUrl, buildAuditPublishPayload } from './socialAuditPost.js';

export const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // = TTL de caché de auditPlace
export const PRIORITY_RATIO = 0.8;
export const DEFAULT_NETWORKS = ['linkedin', 'instagram', 'facebook'];

const VALID_NETWORKS = ['linkedin', 'instagram', 'facebook'];
const SUMMARY_MAX = 240;

// Sitios con web por corrida (configurable desde la tarjeta del admin). El tope de comercios
// examinados es el doble: cada uno es una consulta de detalle paga de Google Places.
export const CANTIDAD_DEFAULT = 15;
export const CANTIDAD_MIN = 3;
export const CANTIDAD_MAX = 30;
export const FAST_MAX_SITES = 8; // "Correr ahora" corre en Vercel Hobby (corte a los 60 s)
export const CORRIDAS_POR_MES = 4 * 4.3; // cron-job.org: lun/mié/vie/sáb

export function consumoMensual(cantidad) {
  return Math.round(2 * cantidad * CORRIDAS_POR_MES);
}

export function comboKey(ciudad, rubro) {
  return `${ciudad}|${rubro.label}`;
}

// Una entrada de "ciudades" es una ciudad sola ("Bariloche") o una zona con sus localidades
// ("Alto Valle: Neuquén, Plottier, Cipolletti"). Una zona sale en un solo informe con los sitios
// de todas sus localidades; la primera localidad es la cabecera.
export function parseZona(entry) {
  const text = String(entry).trim();
  const i = text.indexOf(':');
  if (i < 0) return { nombre: text, ciudades: [text] };
  const nombre = text.slice(0, i).trim();
  const ciudades = [...new Set(text.slice(i + 1).split(',').map(c => c.trim()).filter(Boolean))];
  return { nombre, ciudades: ciudades.length ? ciudades : [nombre] };
}

// Forma canónica para guardar: "Nombre: a, b, c" (o solo "Nombre" si es una ciudad sola).
function formatZona(entry) {
  const { nombre, ciudades } = parseZona(entry);
  return ciudades.length === 1 && ciudades[0] === nombre ? nombre : `${nombre}: ${ciudades.join(', ')}`;
}

// Elige la próxima combinación ciudad (o zona) × rubro. Respeta la proporción prioritarios/secundarios,
// nunca repite una combinación dentro de COOLDOWN_MS y, dentro del pool, toma la corrida hace
// más tiempo (las nunca corridas primero; empate → al azar).
export function pickNext(config, nowMs = Date.now(), rand = Math.random) {
  const ciudades = config?.ciudades || [];
  const rubros = config?.rubros || [];
  const last = config?.ultimaCorrida || {};

  const eligible = [];
  for (const entry of ciudades) {
    const zona = parseZona(entry);
    if (!zona.nombre) continue;
    for (const rubro of rubros) {
      const lastRun = last[comboKey(zona.nombre, rubro)] || 0;
      if (nowMs - lastRun >= COOLDOWN_MS) eligible.push({ ciudad: zona.nombre, ciudades: zona.ciudades, rubro, lastRun });
    }
  }
  if (!eligible.length) return null;

  const prio = eligible.filter(c => c.rubro.prioritario);
  const sec = eligible.filter(c => !c.rubro.prioritario);
  let pool = rand() < PRIORITY_RATIO ? prio : sec;
  if (!pool.length) pool = prio.length ? prio : sec;

  const oldest = Math.min(...pool.map(c => c.lastRun));
  const candidates = pool.filter(c => c.lastRun === oldest);
  const pick = candidates[Math.floor(rand() * candidates.length)];
  return { ciudad: pick.ciudad, ciudades: pick.ciudades, rubro: pick.rubro };
}

// Mismo shape que stats de POST /api/auditorias.
export function buildStats(results) {
  const total = results.length;
  const scored = results.filter(r => typeof r.seoScore === 'number');
  const avgSeoScore = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.seoScore, 0) / scored.length)
    : null;
  const lowSeoCount = scored.filter(r => r.seoScore < 50).length;
  const withEmail = results.filter(r => r.email).length;
  return { total, avgSeoScore, lowSeoCount, withEmail };
}

function clip(text, max) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Post para redes: SOLO datos agregados, nunca nombres de negocios.
export function buildPost({ combo, stats, auditoriaId, summary, networks }) {
  const { ciudad, rubro } = combo;
  const title = `Auditoría SEO de ${stats.total} sitios de ${rubro.label} en ${ciudad}`;
  const pctLow = stats.total ? Math.round((stats.lowSeoCount / stats.total) * 100) : 0;

  const lines = [
    title,
    '',
    `📊 SEO promedio: ${stats.avgSeoScore ?? '—'}/100`,
    `⚠️ ${pctLow}% (${stats.lowSeoCount} de ${stats.total}) con posicionamiento débil (menos de 50)`,
  ];
  if (summary && String(summary).trim()) {
    lines.push('', clip(summary, SUMMARY_MAX));
  }
  lines.push('', `Ver el informe completo: ${auditReportUrl(auditoriaId)}`);
  lines.push('', '#SEO #MarketingDigital #PresenciaDigital #NegociosLocales');

  return {
    title,
    payload: buildAuditPublishPayload({
      caption: lines.join('\n'),
      networks: networks?.length ? networks : DEFAULT_NETWORKS,
      auditoriaId,
    }),
  };
}

// Valida el PATCH del admin sobre auditoria_auto/config. Devuelve { update } o { error }.
export function validateConfigPatch(body) {
  const update = {};

  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') return { error: 'activo debe ser boolean' };
    update.activo = body.activo;
  }

  if ('ciudades' in body) {
    if (!Array.isArray(body.ciudades)) return { error: 'ciudades debe ser un array de textos' };
    const ciudades = [...new Set(
      body.ciudades.map(c => (typeof c === 'string' && c.trim() ? formatZona(c) : '')).filter(Boolean)
    )];
    if (ciudades.some(c => !parseZona(c).nombre)) return { error: 'ciudades: cada zona necesita un nombre antes de los dos puntos' };
    if (!ciudades.length || ciudades.length > 300) return { error: 'ciudades: debe haber entre 1 y 300' };
    update.ciudades = ciudades;
  }

  if ('rubros' in body) {
    if (!Array.isArray(body.rubros) || !body.rubros.length || body.rubros.length > 300) {
      return { error: 'rubros: debe ser un array de 1 a 300 elementos' };
    }
    const rubros = [];
    for (const r of body.rubros) {
      const label = typeof r?.label === 'string' ? r.label.trim() : '';
      const value = typeof r?.value === 'string' ? r.value.trim() : '';
      if (!label || !value || !['type', 'text'].includes(r?.kind) || typeof r?.prioritario !== 'boolean') {
        return { error: 'rubros: cada rubro necesita label, value, kind (type|text) y prioritario (boolean)' };
      }
      rubros.push({ label, kind: r.kind, value, prioritario: r.prioritario });
    }
    update.rubros = rubros;
  }

  if ('networks' in body) {
    if (!Array.isArray(body.networks) || !body.networks.length
        || !body.networks.every(n => VALID_NETWORKS.includes(n))) {
      return { error: `networks: debe ser un subconjunto no vacío de ${VALID_NETWORKS.join(', ')}` };
    }
    update.networks = [...new Set(body.networks)];
  }

  if ('cantidad' in body) {
    const c = body.cantidad;
    if (!Number.isInteger(c) || c < CANTIDAD_MIN || c > CANTIDAD_MAX) {
      return { error: `cantidad: debe ser un entero entre ${CANTIDAD_MIN} y ${CANTIDAD_MAX}` };
    }
    update.cantidad = c;
  }
  if (!Object.keys(update).length) {
    return { error: 'Nada para actualizar (activo, ciudades, rubros, networks o cantidad)' };
  }
  return { update };
}
