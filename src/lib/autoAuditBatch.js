// src/lib/autoAuditBatch.js
import { runLeadFinderAction } from '@/app/api/lead-finder/route';
import { searchLeads, leadToAuditRow } from '@/lib/leadSearch';

export const RADIO_KM = 15;

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
  const localidades = [...resto, cabecera];

  const results = [];
  let examined = 0;
  let found = null;
  let primerAviso = null;
  let status = 'ok';
  let error;

  try {
    const gen = searchLeads({
      zonas: localidades.map(c => ({ ciudad: c, pais: 'Argentina' })),
      repartirEntreZonas: localidades.length > 1,
      terminos: rubro.kind === 'text' ? [rubro.value] : [],
      tipos: rubro.kind === 'text' ? [] : [{ id: rubro.value, label: rubro.label }],
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
