// Cotización del dólar oficial (venta) para cobrar en pesos. Dos fuentes; si fallan las dos, tira:
// para cobrar no se usa un número inventado (el exchangeService del navegador cae a un fijo viejo).
const FUENTES = [
  ['bluelytics', 'https://api.bluelytics.com.ar/v2/latest', (j) => j?.oficial?.value_sell],
  ['dolarapi', 'https://dolarapi.com/v1/dolares/oficial', (j) => j?.venta],
];
const TTL = 10 * 60 * 1000;
let cache = null;

export async function dolarOficialVenta({ fetchImpl = fetch, now = Date.now() } = {}) {
  if (cache && now - cache.at < TTL) return cache.valor;
  const errores = [];
  for (const [nombre, url, leer] of FUENTES) {
    try {
      const r = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const v = Number(leer(await r.json()));
      if (!Number.isFinite(v) || v <= 0) throw new Error('valor inválido');
      cache = { at: now, valor: { cotizacion: v, fuente: nombre } };
      return cache.valor;
    } catch (e) {
      errores.push(`${nombre}: ${e.message}`);
    }
  }
  throw new Error(`No se pudo obtener la cotización del dólar (${errores.join(' · ')})`);
}

export const _resetDolarCache = () => { cache = null; };
