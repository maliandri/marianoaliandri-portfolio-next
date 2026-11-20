// Seguidores / seguidos de Instagram a partir del export oficial ("Descargar tu información", JSON).
// La Graph API no entrega estas listas, por eso se sube el export. Lógica pura, sin I/O.
//
// followers_1.json (puede haber followers_2.json…): [{ string_list_data: [{ href, value, timestamp }] }]
// following.json: { relationships_following: [{ title: 'usuario', string_list_data: [{ href, timestamp }] }] }

const handleDe = (entry, item) => {
  const raw = entry?.value || item?.title || String(entry?.href || '').split('/').filter(Boolean).pop() || '';
  return String(raw).trim().replace(/^@/, '').toLowerCase();
};

/** Saca [{ handle, ts }] de un JSON del export (acepta array o el objeto de `following`). */
export function parseIgExport(json) {
  let items = [];
  if (Array.isArray(json)) items = json;
  else if (json && typeof json === 'object') {
    const key = Object.keys(json).find(k => Array.isArray(json[k]));
    items = key ? json[key] : [];
  }
  const out = [];
  for (const item of items) {
    for (const entry of item?.string_list_data || []) {
      const handle = handleDe(entry, item);
      if (handle) out.push({ handle, ts: entry.timestamp || 0 });
    }
  }
  return out;
}

const unicos = (lista) => {
  const map = new Map();
  for (const x of lista) if (!map.has(x.handle) || x.ts > map.get(x.handle).ts) map.set(x.handle, x);
  return [...map.values()];
};

/** Cruza las dos listas. Cada fila: { handle, ts, meSigue, loSigo }. */
export function cruzar(seguidores, seguidos) {
  const a = unicos(seguidores);
  const b = unicos(seguidos);
  const seguidoresSet = new Set(a.map(x => x.handle));
  const seguidosSet = new Set(b.map(x => x.handle));
  const noMeSiguen = b.filter(x => !seguidoresSet.has(x.handle)).map(x => ({ ...x, meSigue: false, loSigo: true }));
  const mutuos = b.filter(x => seguidoresSet.has(x.handle)).map(x => ({ ...x, meSigue: true, loSigo: true }));
  const nosigo = a.filter(x => !seguidosSet.has(x.handle)).map(x => ({ ...x, meSigue: true, loSigo: false }));
  return {
    stats: { seguidores: a.length, seguidos: b.length, mutuos: mutuos.length, noMeSiguen: noMeSiguen.length, noSigo: nosigo.length },
    filas: [...noMeSiguen, ...mutuos, ...nosigo],
  };
}

export const igUrl = (handle) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;
