// Informes de demanda por zona (/demanda): lógica pura, sin I/O. La corrida está en
// src/lib/demandaAutoRun.js. Datos = autocompletado de Google (src/lib/rubroDemand.js):
// dice qué se busca y en qué orden, no cuántas veces → se muestra como "índice de demanda".

export const TOP_N = 20;                 // rubros que muestra el informe público (la lista completa es de Analítica)
export const MIN_RUBROS_CON_DATOS = 20;  // menos que esto = Google nos limitó: no se publica
export const COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000; // una zona sale como mucho una vez por semana
const SITE_URL = 'https://marianoaliandri.com.ar';
const EJEMPLOS = 3;

// Cómo se escribe la localidad en la búsqueda (el nombre oficial a veces no es lo que tipea la gente).
const ALIAS_BUSQUEDA = { 'Ciudad Autónoma de Buenos Aires': 'CABA' };
export const busquedaDe = (localidad) => ALIAS_BUSQUEDA[localidad] || localidad;

export const zonaId = (nombre) => String(nombre || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ¿La frase nombra la localidad como palabra entera? "jardín allende" no es de Allen.
export function mencionaLocalidad(frase, busqueda) {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(normTxt(busqueda))}([^a-z0-9]|$)`);
  return re.test(normTxt(frase));
}

// Deja solo las frases que nombran la localidad y achica el puntaje en la misma proporción:
// el autocompletado completa "Allen" con "allende" o "allentown pa", que no son de la ciudad.
function soloDeLaLocalidad(r, busqueda) {
  const sugs = r.suggestions || [];
  if (!sugs.length) return { ...r, raw: 0, count: 0, suggestions: [] };
  const propias = sugs.filter(s => mencionaLocalidad(s, busqueda));
  const f = propias.length / sugs.length;
  return { ...r, raw: (r.raw || 0) * f, count: Math.round((r.count || 0) * f), suggestions: propias };
}

// perLocalidad: [{ localidad, busqueda?, analyzed: [{ id, label, cat, count, raw, suggestions }] }]
// Índice de la zona = suma de los puntajes crudos de cada localidad, normalizado (el primero = 100).
// porLocalidad = índice dentro de cada localidad (su rubro más buscado = 100): sirve para ver
// qué se busca más en cada lugar sin que la ciudad grande tape a las chicas.
export function aggregateZone(perLocalidad, topN = TOP_N) {
  const byId = new Map();
  for (const { localidad, busqueda = localidad, analyzed: crudo } of perLocalidad) {
    const analyzed = crudo.map(r => soloDeLaLocalidad(r, busqueda));
    const maxLoc = analyzed.reduce((m, r) => Math.max(m, r.raw || 0), 0) || 1;
    for (const r of analyzed) {
      const acc = byId.get(r.id) || { id: r.id, label: r.label, cat: r.cat, raw: 0, count: 0, fuentes: [], porLocalidad: [] };
      acc.raw += r.raw || 0;
      acc.count += r.count || 0;
      acc.porLocalidad.push({ localidad, interes: Math.round(((r.raw || 0) / maxLoc) * 100) });
      if (r.suggestions?.length) acc.fuentes.push({ raw: r.raw || 0, suggestions: r.suggestions });
      byId.set(r.id, acc);
    }
  }
  const todos = [...byId.values()].filter(r => r.count > 0);
  const maxRaw = todos.reduce((m, r) => Math.max(m, r.raw), 0) || 1;
  const ranked = todos
    .map(r => ({ ...r, interes: Math.round((r.raw / maxRaw) * 100) }))
    .sort((a, b) => b.raw - a.raw || b.count - a.count);

  const top = ranked.slice(0, topN).map((r, i) => {
    const ejemplos = [];
    for (const f of [...r.fuentes].sort((a, b) => b.raw - a.raw)) {
      for (const s of f.suggestions) if (!ejemplos.includes(s) && ejemplos.length < EJEMPLOS) ejemplos.push(s);
    }
    return { id: r.id, label: r.label, cat: r.cat || null, pos: i + 1, interes: r.interes, ejemplos, porLocalidad: r.porLocalidad };
  });
  return { top, rubrosConDatos: todos.length };
}

// Compara con el informe anterior de la misma zona. cambio > 0 = subió esos puestos.
// Sin informe anterior, cambio queda en null (no hay con qué comparar).
export function withCambios(top, prevTop) {
  if (!prevTop?.length) return top.map(r => ({ ...r, cambio: null, nuevo: false }));
  const prevPos = new Map(prevTop.map(r => [r.id, r.pos]));
  return top.map(r => {
    const antes = prevPos.get(r.id);
    return { ...r, cambio: antes ? antes - r.pos : null, nuevo: !antes };
  });
}

// Próxima zona: la que hace más tiempo que no sale (nunca = primero), respetando el cooldown.
export function pickZona(config, nowMs = Date.now()) {
  const last = config?.ultimaCorrida || {};
  const elegibles = (config?.zonas || [])
    .filter(z => z.localidades?.length && nowMs - (last[z.id] || 0) >= COOLDOWN_MS)
    .sort((a, b) => (last[a.id] || 0) - (last[b.id] || 0));
  return elegibles[0] || null;
}

export function demandaReportUrl(id) {
  return `${SITE_URL}/demanda/${id}/`;
}

const MEDALLAS = ['🥇', '🥈', '🥉'];
const hashtag = (s) => '#' + String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');

export function fechaLarga(ms) {
  return new Date(ms).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
  });
}

// Texto del post (LinkedIn, Facebook e Instagram): solo datos del informe, sin IA (sale solo, sin
// revisión). En Instagram el link no es clickeable; igual queda escrito.
export function buildDemandaCaption(reporte, id) {
  const { zona, localidades, top, createdAtMs } = reporte;
  const [primero] = top;
  const lines = [`¿Qué se busca en Google en ${zona}? 🔎`];
  if (localidades.length > 1) lines.push(`(${localidades.join(', ')})`);
  lines.push('', `Ranking de rubros por demanda de búsqueda, ${fechaLarga(createdAtMs)}:`, '');
  top.slice(0, 3).forEach((r, i) => lines.push(`${MEDALLAS[i]} ${r.label}`));

  const subio = top.filter(r => r.cambio > 0).sort((a, b) => b.cambio - a.cambio)[0];
  if (subio) lines.push('', `📈 El que más subió: ${subio.label} (+${subio.cambio} ${subio.cambio === 1 ? 'puesto' : 'puestos'})`);

  if (localidades.length > 1 && primero.porLocalidad?.length) {
    const donde = [...primero.porLocalidad].sort((a, b) => b.interes - a.interes)[0];
    if (donde?.interes > 0) lines.push(`📍 Donde más se busca ${primero.label.toLowerCase()}: ${donde.localidad}`);
  }
  if (primero.ejemplos?.[0]) lines.push(`💬 Lo que escribe la gente: "${primero.ejemplos[0]}"`);

  lines.push(
    '',
    `Si tenés un negocio de ${primero.label.toLowerCase()} en la zona, esa gente ya te está buscando. ¿Te encuentra?`,
    '',
    `Los ${top.length} rubros más buscados, zona por zona: ${demandaReportUrl(id)}`,
    '',
    ['#NegociosLocales', '#MarketingDigital', hashtag(zona)].join(' '),
  );
  return lines.join('\n');
}

// PATCH del admin sobre demanda_auto/config. Devuelve { update } o { error }.
export function validateDemandaPatch(body) {
  const update = {};
  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') return { error: 'activo debe ser boolean' };
    update.activo = body.activo;
  }
  if ('zonas' in body) {
    if (!Array.isArray(body.zonas) || !body.zonas.length || body.zonas.length > 30) {
      return { error: 'zonas: entre 1 y 30' };
    }
    const zonas = [];
    for (const z of body.zonas) {
      const nombre = typeof z?.nombre === 'string' ? z.nombre.trim().slice(0, 60) : '';
      const id = zonaId(nombre);
      if (!id) return { error: 'Cada zona necesita un nombre' };
      if (zonas.some(x => x.id === id)) return { error: `Zona repetida: ${nombre}` };
      if (!Array.isArray(z.localidades) || !z.localidades.length || z.localidades.length > 15) {
        return { error: `${nombre}: entre 1 y 15 localidades` };
      }
      const localidades = [];
      for (const l of z.localidades) {
        const provincia = typeof l?.provincia === 'string' ? l.provincia.trim() : '';
        const localidad = typeof l?.localidad === 'string' ? l.localidad.trim() : '';
        if (!provincia || !localidad) return { error: `${nombre}: cada localidad necesita provincia y localidad` };
        if (!localidades.some(x => x.provincia === provincia && x.localidad === localidad)) localidades.push({ provincia, localidad });
      }
      zonas.push({ id, nombre, localidades });
    }
    update.zonas = zonas;
  }
  if (!Object.keys(update).length) return { error: 'Nada para actualizar' };
  return { update };
}
