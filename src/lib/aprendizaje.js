// Capa de autoaprendizaje del servidor MCP: qué pide Mariano que el conector no sabe hacer
// (mcp_gaps), ideas sueltas (mcp_ideas) y cómo se usan las tools (mcp_tool_calls).
// Lógica pura: recibe los docs ya leídos y devuelve los agrupados. Sin I/O.

export const ESTADOS = ['nuevo', 'en_desarrollo', 'hecho', 'descartado'];
export const ABIERTOS = ['nuevo', 'en_desarrollo'];
export const CATEGORIAS = ['herramienta', 'mejora', 'negocio', 'contenido'];
export const PRIORIDADES = ['alta', 'media', 'baja'];

const PRIO_ORDEN = { alta: 0, media: 1, baja: 2 };
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

// Clave para juntar pedidos parecidos: minúsculas, sin acentos ni signos.
export function normalizarClave(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Lo que más se pide sin poder hacerlo: faltantes abiertos agrupados por herramienta sugerida
// (o por el pedido, si no tiene), del más repetido al menos.
export function agruparFaltantes(gaps, { top = 10 } = {}) {
  const grupos = new Map();
  for (const g of gaps) {
    if (!ABIERTOS.includes(g.estado)) continue;
    const clave = normalizarClave(g.herramientaSugerida) || normalizarClave(g.pedido).slice(0, 80);
    if (!clave) continue;
    const x = grupos.get(clave) || { herramienta: g.herramientaSugerida || null, ejemplo: g.pedido, veces: 0, ultimaMs: 0, ids: [] };
    x.veces += 1;
    if ((g.creadoMs || 0) >= x.ultimaMs) { x.ultimaMs = g.creadoMs || 0; x.ejemplo = g.pedido; }
    x.ids.push(g.id);
    grupos.set(clave, x);
  }
  return [...grupos.values()]
    .sort((a, b) => b.veces - a.veces || b.ultimaMs - a.ultimaMs)
    .slice(0, top)
    .map(x => ({ herramienta: x.herramienta, ejemplo: x.ejemplo, veces: x.veces, ultima: iso(x.ultimaMs), ids: x.ids.slice(0, 5) }));
}

// Tools con errores: solo las que tienen al menos `minLlamadas`, ordenadas por tasa de error.
export function herramientasQueFallan(calls, { minLlamadas = 3, top = 10 } = {}) {
  const por = new Map();
  for (const c of calls) {
    const x = por.get(c.tool) || { tool: c.tool, llamadas: 0, errores: 0, internos: 0, ultimoError: null, ultimoErrorMs: 0 };
    x.llamadas += 1;
    if (!c.ok) {
      x.errores += 1;
      if (c.tipoError === 'interno') x.internos += 1;
      if ((c.atMs || 0) >= x.ultimoErrorMs) { x.ultimoErrorMs = c.atMs || 0; x.ultimoError = c.error || null; }
    }
    por.set(c.tool, x);
  }
  return [...por.values()]
    .filter(x => x.errores > 0 && x.llamadas >= minLlamadas)
    .map(x => ({ ...x, tasaError: Math.round((x.errores / x.llamadas) * 100) }))
    .sort((a, b) => b.tasaError - a.tasaError || b.errores - a.errores)
    .slice(0, top)
    .map(({ ultimoErrorMs, ...x }) => ({ ...x, ultimoErrorEn: iso(ultimoErrorMs) }));
}

// Tools registradas en el servidor que no aparecen en las llamadas del período.
export function herramientasSinUso(nombres, calls) {
  const usadas = new Set(calls.map(c => c.tool));
  return nombres.filter(n => !usadas.has(n)).sort();
}

// Ideas abiertas: primero por prioridad (alta, media, baja, sin prioridad), después las más nuevas.
export function ideasPendientes(ideas, { top = 20 } = {}) {
  return ideas
    .filter(i => ABIERTOS.includes(i.estado))
    .sort((a, b) => (PRIO_ORDEN[a.prioridad] ?? 3) - (PRIO_ORDEN[b.prioridad] ?? 3) || (b.creadoMs || 0) - (a.creadoMs || 0))
    .slice(0, top)
    .map(i => ({ id: i.id, idea: i.idea, categoria: i.categoria || null, prioridad: i.prioridad || null, estado: i.estado, creada: iso(i.creadoMs) }));
}
