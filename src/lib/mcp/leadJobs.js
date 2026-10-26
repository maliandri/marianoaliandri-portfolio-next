import { FieldValue } from 'firebase-admin/firestore';
import { searchLeads, parseZona, reduceLeadEvent, ESTADO_INICIAL } from '@/lib/leadSearch';
import { demandaDe, labelToIdFor, tipoParams } from '@/lib/leadDemand';
import { saveSearch } from '@/lib/leadSearchesStore';
import { placesBudget, bumpMcpPlaces } from './placesBudget';

// Búsqueda de leads del servidor MCP: corre en segundo plano (after) y guarda el progreso en
// mcp_lead_jobs/{id}; Claude lo consulta con get_lead_search. Usa el mismo motor que la pantalla.

const JOBS = 'mcp_lead_jobs';
const PAID = new Set(['searchText', 'searchNearby', 'auditPlace']);
const SAVE_EVERY = 5;
const MAX_AVISOS = 30;

// Localidad "Ciudad, Provincia" (+ ", País" opcional) → zona del motor. Sin país, Argentina.
export function toEngineParams(p) {
  const zonas = (p.localidades || []).map(l => {
    const partes = String(l).split(',').map(s => s.trim()).filter(Boolean);
    return parseZona(partes.length >= 3 ? partes.join(', ') : `${partes.join(', ')}, Argentina`);
  });
  return {
    zonas,
    tipos: tipoParams(p.rubros || [], 'es'),
    terminos: p.terminos || [],
    radioKm: p.radio_km || 10,
    cantidad: p.cantidad,
    perfil: p.perfil === 'empresa' ? 'empresa' : 'dev',
    producto: p.producto || '',
  };
}

export async function createLeadJob(db, uid, params) {
  const ref = await db.collection(JOBS).add({
    uid, status: 'running', params, totals: ESTADO_INICIAL.totals, avisos: [], leads: [],
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getLeadJob(db, uid, jobId) {
  const snap = await db.collection(JOBS).doc(jobId).get();
  if (!snap.exists || snap.data().uid !== uid) return null;
  return { id: snap.id, ...snap.data() };
}

export async function runLeadJob(db, user, jobId, params, { call, sleep, deadlineMs = 700_000 }) {
  const ref = db.collection(JOBS).doc(jobId);
  const t0 = Date.now();
  const engine = toEngineParams(params);
  let acc = ESTADO_INICIAL;
  const avisos = [];
  const aviso = (m) => { if (avisos.length < MAX_AVISOS) avisos.push(m); };
  const save = (patch) => ref.set({
    ...patch, totals: acc.totals, leads: acc.leads, avisos, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    const budget = await placesBudget(db);
    let usados = 0;
    let sinCupo = !budget.ok;
    if (sinCupo) aviso(`No se buscó: se terminó el cupo ${budget.reason} de Google Places del MCP.`);

    // Presupuesto de Places alrededor del call (lo que cuesta plata se cuenta acá).
    const budgeted = async (action, p) => {
      if (PAID.has(action)) {
        if (sinCupo || budget.usedToday + usados >= budget.dailyCap) {
          if (!sinCupo) aviso('Se cortó la búsqueda: se terminó el cupo diario de Google Places del MCP.');
          sinCupo = true;
          throw new Error('Sin cupo de Google Places');
        }
      }
      const res = await call(action, p);
      if (PAID.has(action) && !(action === 'auditPlace' && (res.fromCache || res.fromMyHistory))) {
        usados++;
        await bumpMcpPlaces(db, 1);
      }
      return res;
    };

    // Demanda por zona en paralelo a la búsqueda (gratis; si falla, los leads salen sin ella).
    const demandaPromise = Promise.all(engine.zonas.map(z =>
      call('rubroDemand', { localidad: z.ciudad, terminos: engine.terminos })
        .then(d => [z.ciudad, d]).catch(() => null)));

    if (!sinCupo) {
      let n = 0;
      const isCancelled = () => sinCupo || Date.now() - t0 > deadlineMs;
      for await (const ev of searchLeads(engine, { call: budgeted, sleep, isCancelled })) {
        acc = reduceLeadEvent(acc, ev);
        if (ev.type === 'aviso' && !/Sin cupo/.test(ev.mensaje)) aviso(ev.mensaje);
        if (++n % SAVE_EVERY === 0) await save({});
      }
      if (Date.now() - t0 > deadlineMs) aviso('Se cortó la búsqueda por tiempo; devuelve lo encontrado hasta ahí.');
    }

    const dmap = Object.fromEntries((await demandaPromise).filter(Boolean));
    const l2id = labelToIdFor(params.rubros || [], 'es');
    acc = { ...acc, leads: acc.leads.map(l => ({ ...l, demanda: demandaDe(l, dmap, l2id) })) };

    let searchId = null;
    if (acc.leads.length) {
      searchId = await saveSearch(db, user.uid, {
        ciudades: params.localidades, tipos: params.rubros || [], terminos: engine.terminos, radioKm: engine.radioKm,
        perfil: engine.perfil, producto: engine.producto, stats: acc.totals, origen: 'admin', via: 'mcp', results: acc.leads,
      }, { isAdmin: true });
    }
    await save({ status: 'done', searchId });
  } catch (e) {
    console.error('[mcp] search_leads falló:', e.message);
    await save({ status: 'error', error: String(e.message).slice(0, 300) });
  }
}
