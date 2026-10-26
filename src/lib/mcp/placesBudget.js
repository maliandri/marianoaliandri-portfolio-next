import { FieldValue } from 'firebase-admin/firestore';
import { PLACES_LIMITS } from '@/data/placesFreeTier';
import { envInt } from './config';

// Presupuesto de Google Places para el servidor MCP (lo que cuesta plata). Dos frenos:
// - tope diario propio del MCP (`mcpPlaces` en leadfinder_usage/{día}, MCP_PLACES_DAILY_CAP);
// - corte mensual si algún SKU pasa el 90 % del cupo gratis (contadores globales de bumpUsage).
const USAGE = 'leadfinder_usage';
const MONTH_CUT_PCT = 90;
const SKU_FIELDS = { details: 'getPlaceRequests', searchText: 'searchTextRequests', searchNearby: 'searchNearbyRequests' };

const dayKey = (now) => now.toISOString().slice(0, 10);

export async function placesBudget(db, { now = new Date() } = {}) {
  const dailyCap = envInt('MCP_PLACES_DAILY_CAP', 150);
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const snap = await db.collection(USAGE)
    .where('__name__', '>=', `${month}-01`)
    .where('__name__', '<=', `${month}-31`)
    .get();

  let usedToday = 0;
  const totals = { details: 0, searchText: 0, searchNearby: 0 };
  for (const d of snap.docs) {
    const x = d.data();
    if (d.id === today) usedToday = x.mcpPlaces || 0;
    for (const [sku, field] of Object.entries(SKU_FIELDS)) totals[sku] += x[field] || 0;
  }
  const monthPct = Math.max(...Object.keys(SKU_FIELDS).map(sku => (totals[sku] / PLACES_LIMITS[sku].free) * 100));
  const base = { usedToday, dailyCap, monthPct: Math.round(monthPct * 10) / 10 };

  if (usedToday >= dailyCap) return { ok: false, reason: 'diario', ...base };
  if (monthPct > MONTH_CUT_PCT) return { ok: false, reason: 'mensual', ...base };
  return { ok: true, ...base };
}

export async function bumpMcpPlaces(db, n = 1, now = new Date()) {
  await db.collection(USAGE).doc(dayKey(now)).set(
    { mcpPlaces: FieldValue.increment(n), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
