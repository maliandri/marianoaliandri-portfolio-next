// Resumen de una auditoría para el listado público (/auditorias).
// Todo corre server-side: el cliente solo recibe conteos por rango de score y la
// geometría del mapa (posiciones relativas de tiles y puntos), nunca los datos por
// negocio (nombre, email, teléfono, dirección).

// Rangos de Score SEO, del mejor al peor. `key` se usa como sufijo de la variable
// CSS del color (--score-100, --score-80, ...), definida por tema en auditorias.module.css.
export const SCORE_BUCKETS = [
  { key: '100', label: '100',   test: s => s >= 100 },
  { key: '80',  label: '80–99', test: s => s >= 80 && s < 100 },
  { key: '50',  label: '50–79', test: s => s >= 50 && s < 80 },
  { key: '0',   label: '< 50',  test: s => s < 50 },
];

export function bucketOf(score) {
  return SCORE_BUCKETS.find(b => b.test(score))?.key ?? null;
}

// Porcentajes enteros que suman exactamente 100 (método del mayor resto),
// así la barra apilada y la leyenda nunca muestran 99% o 101% en total.
function percents(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map(n => (n / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

export function scoreDistribution(results = []) {
  const scores = results.map(r => r?.seoScore).filter(s => typeof s === 'number' && Number.isFinite(s));
  const counts = SCORE_BUCKETS.map(b => scores.filter(b.test).length);
  const pcts = percents(counts);
  return {
    total: scores.length,
    buckets: SCORE_BUCKETS.map((b, i) => ({ key: b.key, label: b.label, n: counts[i], pct: pcts[i] })),
  };
}

// Ciudades de la auditoría: las de la config y, si faltan (auditorías viejas), las
// que aparecen en los resultados, ordenadas por cantidad de negocios.
export function auditCities(config, results = []) {
  const fromConfig = (config?.ciudades || []).filter(Boolean);
  if (fromConfig.length) return fromConfig;
  const count = {};
  for (const r of results) if (r?.ciudad) count[r.ciudad] = (count[r.ciudad] || 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Auditoría SEO de páginas web de Empresa Constructora (09 de octubre de 2026)" → "Empresa Constructora".
// Los títulos se escribieron a mano en distintas épocas, así que se limpian los
// patrones conocidos; si no queda nada razonable se usa el término de búsqueda.
export function shortTitle(title = '', cities = [], results = []) {
  let s = String(title)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/^auditor[ií]a\s+seo\s*/i, '')
    .replace(/^[—–-]\s*/, '')
    .replace(/^de\s+\d+\s+sitios?\s+de\s+/i, '')
    .replace(/^de\s+p[áa]ginas\s+web\s+de\s+/i, '')
    .replace(/^(a|de)\s+/i, '');

  for (const c of cities) {
    const city = escapeRe(c);
    s = s
      .replace(new RegExp(`\\s*[—–-]\\s*${city}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s*,\\s*${city}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s+en\\s+${city}\\s*$`, 'i'), '')
      .replace(new RegExp(`^${city}\\s*,?\\s+`, 'i'), '');
  }
  s = s.replace(/^(a|de)\s+/i, '').replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim();

  if (!s || s.length > 60) {
    const tipos = {};
    for (const r of results) if (r?.tipo) tipos[r.tipo] = (tipos[r.tipo] || 0) + 1;
    const top = Object.entries(tipos).sort((a, b) => b[1] - a[1])[0]?.[0];
    s = top || s || 'Auditoría';
  }
  // Algunos términos vienen en mayúsculas ("CONSTRUCCION MODULAR"): se pasan a oración.
  if (s === s.toUpperCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Mapa estático armado con tiles ----------

function distKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Mismo criterio que el mapa del detalle (AuditMap.jsx): descarta coordenadas mal
// cargadas o sedes lejanas para que no achiquen el zoom de toda la zona.
function inliers(points, radioKm) {
  if (points.length <= 2) return points;
  const center = [median(points.map(p => p.lat)), median(points.map(p => p.lon))];
  const threshold = Math.max((radioKm || 20) * 3, 100);
  const keep = points.filter(p => distKm(center, [p.lat, p.lon]) <= threshold);
  return keep.length ? keep : points;
}

const TILE = 256;
const project = (lat, lon, z) => {
  const scale = TILE * 2 ** z;
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [
    ((lon + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
};

const pct = v => Math.round(v * 10000) / 100; // 2 decimales, en %

// Devuelve la geometría de un mapa de W×H "píxeles de mapa" en porcentajes, para
// posicionar <img> de tiles y los puntos sobre un contenedor con aspect-ratio fijo
// (se escala a cualquier ancho sin CLS y sin JS).
export function mapPlate(results = [], radioKm, { width = 400, height = 300, pad = 34, maxZoom = 14 } = {}) {
  const all = results
    .filter(r => typeof r?.lat === 'number' && typeof r?.lon === 'number')
    .map(r => ({ lat: r.lat, lon: r.lon, bucket: typeof r.seoScore === 'number' ? bucketOf(r.seoScore) : null }));
  if (!all.length) return null;
  const pts = inliers(all, radioKm);

  let z = maxZoom;
  if (pts.length > 1) {
    for (z = maxZoom; z > 3; z--) {
      const xy = pts.map(p => project(p.lat, p.lon, z));
      const spanX = Math.max(...xy.map(p => p[0])) - Math.min(...xy.map(p => p[0]));
      const spanY = Math.max(...xy.map(p => p[1])) - Math.min(...xy.map(p => p[1]));
      if (spanX <= width - pad * 2 && spanY <= height - pad * 2) break;
    }
  } else {
    z = 13;
  }

  const xy = pts.map(p => project(p.lat, p.lon, z));
  const minX = Math.min(...xy.map(p => p[0])), maxX = Math.max(...xy.map(p => p[0]));
  const minY = Math.min(...xy.map(p => p[1])), maxY = Math.max(...xy.map(p => p[1]));
  const ox = (minX + maxX) / 2 - width / 2;
  const oy = (minY + maxY) / 2 - height / 2;

  const n = 2 ** z;
  const tiles = [];
  for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + height - 1) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + width - 1) / TILE); tx++) {
      const wx = ((tx % n) + n) % n;
      tiles.push({
        src: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`,
        left: pct((tx * TILE - ox) / width),
        top: pct((ty * TILE - oy) / height),
      });
    }
  }

  const center = { lat: median(pts.map(p => p.lat)), lon: median(pts.map(p => p.lon)) };
  const [cx, cy] = project(center.lat, center.lon, z);
  const metersPerPx = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / n;
  const ringPx = radioKm ? (radioKm * 1000) / metersPerPx : 0;

  return {
    aspect: `${width} / ${height}`,
    tileW: pct(TILE / width),
    tileH: pct(TILE / height),
    tiles,
    // Hasta 150 puntos por mapa: más que eso es una mancha y engorda el HTML.
    points: xy.slice(0, 150).map(([x, y], i) => ({
      x: pct((x - ox) / width),
      y: pct((y - oy) / height),
      bucket: pts[i].bucket,
    })),
    ring: ringPx > 6 && ringPx < width * 3
      ? { x: pct((cx - ox) / width), y: pct((cy - oy) / height), w: pct((ringPx * 2) / width), h: pct((ringPx * 2) / height) }
      : null,
    center,
    hidden: all.length - pts.length,
  };
}

// -38.951, -68.059 → "38°57′S 68°04′O"
export function formatCoord(lat, lon) {
  const dm = (v, pos, neg) => {
    const a = Math.abs(v);
    let d = Math.floor(a);
    let m = Math.round((a - d) * 60);
    if (m === 60) { d += 1; m = 0; }
    return `${d}°${String(m).padStart(2, '0')}′${v >= 0 ? pos : neg}`;
  };
  return `${dm(lat, 'N', 'S')} ${dm(lon, 'E', 'O')}`;
}
