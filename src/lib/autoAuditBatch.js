// src/lib/autoAuditBatch.js
import { runLeadFinderAction } from '@/app/api/lead-finder/route';
import { searchLeads, leadToAuditRow } from '@/lib/leadSearch';
import { busquedasDe } from '@/lib/autoAudit';

export const RADIO_KM = 15;
// Con zonas y rubros agrupados una corrida puede pedir muchas búsquedas (localidades × términos).
// 30 × ~17 corridas/mes ≈ 510, debajo del cupo gratis de 1.000 por SKU.
export const MAX_BUSQUEDAS = 30;

// runLeadFinderAction devuelve un Response; el motor espera datos o un Error con .code.
function makeCall(run) {
  return async (action, params) => {
    const data = await (await run(action, params)).json();
    if (!data.ok) throw Object.assign(new Error(data.error || 'Error'), { code: data.code });
    return data;
  };
}

// Audita un lote de negocios de una combinación ciudad (o zona) × rubro con el motor compartido
// (src/lib/leadSearch.js), sin pasar por HTTP. El informe es de SEO: solo leads con web.
export async function runBatch(combo, opts = {}) {
  const {
    budgetMs = 45000, maxSites = 15, maxCandidates = 30,
    run = runLeadFinderAction, now = Date.now, sleep,
  } = opts;
  const deadline = now() + budgetMs;
  const { ciudad, rubro } = combo;
  // Zona: la cabecera (primera localidad) va al final, así se lleva el cupo que dejan libre las chicas.
  const [cabecera, ...resto] = combo.ciudades?.length ? combo.ciudades : [ciudad];
  // "Las Heras (Mendoza)" → "Las Heras, Mendoza": el geocoder lo toma como ciudad + provincia.
  const localidades = [...resto, cabecera].map(c => c.replace(/\s*\(([^)]+)\)\s*$/, ', $1'));

  const results = [];
  let examined = 0;
  let found = null;
  let primerAviso = null;
  let status = 'ok';
  let error;

  try {
    const gen = searchLeads({
      zonas: localidades.map(c => ({ ciudad: c, pais: 'Argentina' })),
      repartirEntreZonas: localidades.length > 1, maxBusquedas: MAX_BUSQUEDAS,
      terminos: busquedasDe(rubro).terminos,
      tipos: busquedasDe(rubro).tipos.map(id => ({ id, label: rubro.label })),
      radioKm: RADIO_KM, cantidad: maxSites, maxExaminados: maxCandidates, soloConWeb: true,
    }, { call: makeCall(run), isCancelled: () => now() >= deadline, ...(sleep ? { sleep } : {}) });

    for await (const ev of gen) {
      if (ev.type === 'negocio') examined++;
      if (ev.type === 'aviso' && !ev.negocioId && !primerAviso) primerAviso = ev.mensaje;
      if (ev.type === 'fin') found = ev.totals.encontrados;
      if (ev.type === 'lead' && typeof ev.lead.seoScore === 'number') {
        results.push({
          ...leadToAuditRow(ev.lead),
          tipo: rubro.label,
          rubro: rubro.label,
          aptoSistemaMedida: rubro.prioritario === true,
        });
      }
    }
  } catch (e) {
    if (e.code === 'QUOTA_EXCEEDED') status = 'cuota_agotada';
    else { status = 'error'; error = e.message; }
  }

  // Sin ningún negocio examinado y con un aviso de ciudad/búsqueda: la combinación falló.
  if (status === 'ok' && examined === 0 && primerAviso) { status = 'error'; error = primerAviso; }

  // agotado: Google se quedó sin negocios (no se cortó por tiempo ni por el tope de getDetails).
  const cortadoPorTiempo = now() >= deadline;
  const agotado = status === 'ok' && !cortadoPorTiempo && examined < maxCandidates;

  return { results, status, ...(status === 'error' ? { error } : {}), examined, found: found ?? examined, agotado, cortadoPorTiempo };
}
