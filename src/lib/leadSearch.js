// Motor único de búsqueda de leads: lo usan la pantalla de Lead Finder (cliente y admin, en el
// navegador) y la auditoría automática (GitHub Actions). No sabe de React ni de HTTP: recibe
// `call(action, params)`, que habla con /api/lead-finder-pro/run o con runLeadFinderAction.
// Ver docs/superpowers/specs/2026-10-12-lead-finder-unificado-design.md
import { clasificarLead } from './leadRule.js';

export const MAX_PAGINAS = 3;
export const PAUSA_PAGINA_MS = 1500; // Google tarda un instante en habilitar el token de la página siguiente
export const FATAL_CODES = ['NO_AUTH', 'NO_PLAN', 'QUOTA_EXCEEDED', 'DISCARD_LIMIT'];
export const isFatal = (e) => FATAL_CODES.includes(e?.code);

const defaultSleep = (ms) => new Promise(r => setTimeout(r, ms));

// Resultado acumulado de los eventos de searchLeads: leads (con su conteo de productos), avisos
// y totales. Lo usan la pantalla (useLeadSearch) y el servidor MCP (src/lib/mcp/leadJobs.js).
export const ESTADO_INICIAL = Object.freeze({
  leads: [], avisos: [], totals: { encontrados: 0, examinados: 0, leads: 0, conWeb: 0, descartados: 0 },
});
export function reduceLeadEvent(s, ev) {
  const t = s.totals;
  switch (ev.type) {
    case 'negocio': return { ...s, totals: { ...t, examinados: t.examinados + 1 } };
    case 'lead': return {
      ...s, leads: [...s.leads, ev.lead],
      totals: { ...t, leads: t.leads + 1, conWeb: t.conWeb + (ev.lead.canal === 'web' ? 1 : 0) },
    };
    case 'descartado': return { ...s, totals: { ...t, descartados: t.descartados + 1 } };
    case 'productos': {
      const { type: _t, id, ...patch } = ev;
      return { ...s, leads: s.leads.map(r => (r.id === id ? { ...r, ...patch } : r)) };
    }
    case 'aviso': return { ...s, avisos: [...s.avisos, ev] };
    case 'fin': return { ...s, totals: { ...t, ...ev.totals } };
    default: return s;
  }
}

// "Ciudad, País" → { ciudad, pais }. Sin coma, país vacío (el geocoder igual la resuelve).
export function parseZona(raw) {
  const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return { ciudad: String(raw).trim(), pais: '' };
  return { ciudad: parts.slice(0, -1).join(', '), pais: parts[parts.length - 1] };
}

// Fila de un informe público de /auditorias: sin teléfono ni dirección (privacidad).
export function leadToAuditRow(lead) {
  return {
    id: lead.id, nombre: lead.nombre, ciudad: lead.ciudad, tipo: lead.tipo,
    lat: lead.lat ?? null, lon: lead.lon ?? null,
    siteUrl: lead.siteUrl, email: lead.email || null, seoScore: lead.seoScore,
    hasSitemap: lead.hasSitemap ?? null, hasRobots: lead.hasRobots ?? null,
    metaDesc: lead.metaDesc ?? null, hasOG: lead.hasOG ?? null,
    lastModified: lead.lastUpdated || lead.lastModified || null,
    rating: lead.rating ?? null,
  };
}

// El informe es de SEO: solo leads con web cuya auditoría dio un puntaje.
export function filasParaInforme(leads) {
  return leads.filter(l => l.canal === 'web' && typeof l.seoScore === 'number').map(leadToAuditRow);
}

// Respuesta de countProducts -> campos de la fila.
export function productosPatch(d) {
  return (d.applicable === false || d.count === null || d.count === undefined)
    ? { prodState: d.partial ? 'error' : 'none' }
    : { prodState: 'done', prodCount: d.count, prodConfidence: d.confidence, prodPartial: !!d.partial };
}

// Filas del historial: las viejas no traen clasificación; se calcula con la misma regla y se
// descartan las que no son leads.
export function normalizarLeadsGuardados(rows) {
  return (rows || []).flatMap(row => {
    if (row.canal !== undefined && row.canal !== null) return [row];
    const cls = clasificarLead(row);
    return cls.esLead ? [{ ...row, ...cls }] : [];
  });
}

export async function* searchLeads(params, deps) {
  const {
    zonas = [], terminos = [], tipos = [], radioKm = 10, cantidad = 10,
    perfil = 'dev', producto = '', soloConWeb = false, repartirEntreZonas = false,
  } = params;
  const maxExaminados = params.maxExaminados ?? cantidad * 3;
  const { call, sleep = defaultSleep, isCancelled = () => false } = deps;
  const keyword = perfil === 'empresa' ? String(producto || '').trim() : '';
  const radiusM = radioKm * 1000;

  const seen = new Set();
  const totals = { encontrados: 0, examinados: 0, leads: 0, conWeb: 0, descartados: 0 };
  const listo = () => totals.leads >= cantidad || totals.examinados >= maxExaminados || isCancelled();
  // repartirEntreZonas: cada localidad examina como mucho su parte de lo que queda del cupo; lo que
  // una no usa pasa a las siguientes (la auditoría automática por zona pone la cabecera al final).
  let topeZona = Infinity;
  let examinadosZona = 0;
  const listoZona = () => listo() || examinadosZona >= topeZona;

  // Conteos de productos: corren en paralelo a la búsqueda; cada uno deja su evento listo y se
  // entrega en el próximo punto de la búsqueda (o al final).
  const pendientes = [];
  const contar = (lead) => {
    const item = { ev: null };
    item.promise = call('countProducts', { placeId: lead.id, keyword })
      .then(productosPatch)
      .catch(() => ({ prodState: 'error' }))
      .then(patch => { item.ev = { type: 'productos', id: lead.id, ...patch }; });
    pendientes.push(item);
  };
  function* drenar() {
    for (let i = 0; i < pendientes.length;) {
      if (pendientes[i].ev) yield pendientes.splice(i, 1)[0].ev;
      else i++;
    }
  }

  const busquedas = [
    ...tipos.map(t => (t.query
      ? { etiqueta: t.label, action: 'searchText', texto: t.query }
      : { etiqueta: t.label, action: 'searchNearby', tipo: t.id })),
    ...terminos.map(term => ({ etiqueta: term, action: 'searchText', texto: term })),
  ];

  try {
    for (const [zi, zona] of zonas.entries()) {
      if (listo()) break;
      if (repartirEntreZonas) {
        topeZona = Math.ceil((maxExaminados - totals.examinados) / (zonas.length - zi));
        examinadosZona = 0;
      }
      yield { type: 'zona', ciudad: zona.ciudad };

      let geo;
      try {
        geo = await call('geocode', { city: zona.ciudad, country: zona.pais || '' });
      } catch (e) {
        if (isFatal(e)) throw e;
        yield { type: 'aviso', ciudad: zona.ciudad, mensaje: `No se pudo ubicar "${zona.ciudad}": ${e.message}` };
        continue;
      }

      for (const b of busquedas) {
        if (listoZona()) break;
        yield { type: 'busqueda', ciudad: zona.ciudad, etiqueta: b.etiqueta };

        let pageToken = null;
        for (let page = 0; page < MAX_PAGINAS && !listoZona(); page++) {
          let res;
          try {
            res = await call(b.action, b.action === 'searchText'
              ? { lat: geo.lat, lon: geo.lon, query: `${b.texto}, ${zona.ciudad}`, radiusM, pageToken }
              : { lat: geo.lat, lon: geo.lon, type: b.tipo, radiusM, pageToken });
          } catch (e) {
            if (isFatal(e)) throw e;
            yield { type: 'aviso', ciudad: zona.ciudad, etiqueta: b.etiqueta, mensaje: `Falló la búsqueda "${b.etiqueta}" en ${zona.ciudad}: ${e.message}` };
            break;
          }

          const nuevos = (res.places || []).filter(p => !seen.has(p.id));
          nuevos.forEach(p => seen.add(p.id));
          totals.encontrados += nuevos.length;

          for (const place of nuevos) {
            if (listoZona()) break;
            const negocio = {
              id: place.id,
              nombre: place.displayName?.text || 'Sin nombre',
              ciudad: zona.ciudad,
              tipo: b.etiqueta,
              lat: place.location?.latitude ?? null,
              lon: place.location?.longitude ?? null,
              previewRating: place.rating ? Number(place.rating).toFixed(1) : null,
            };
            yield { type: 'negocio', negocio };
            totals.examinados++;
            examinadosZona++;

            let audit;
            try {
              audit = await call('auditPlace', { placeId: place.id });
            } catch (e) {
              if (isFatal(e)) throw e;
              yield { type: 'aviso', negocioId: place.id, mensaje: `No se pudo auditar "${negocio.nombre}": ${e.message}` };
              continue;
            }

            // El server de Lead Finder Pro ya clasifica (y cobra según eso); la automática y las
            // entradas viejas del historial no traen clasificación, se calcula acá con la misma regla.
            const { ok: _ok, fromCache: _fc, esLead, canal, whatsapp, placeId: _p, auditedAt: _a, ...datos } = audit;
            const cls = esLead === undefined
              ? clasificarLead(audit)
              : { esLead, canal: canal ?? null, whatsapp: whatsapp ?? null };
            const ficha = { ...negocio, ...datos, ...cls };

            if (!cls.esLead || (soloConWeb && cls.canal !== 'web')) {
              totals.descartados++;
              yield { type: 'descartado', negocio: ficha };
            } else {
              totals.leads++;
              if (cls.canal === 'web') totals.conWeb++;
              const cuenta = !!keyword && cls.canal === 'web';
              yield { type: 'lead', lead: cuenta ? { ...ficha, prodState: 'loading' } : ficha };
              if (cuenta) contar(ficha);
            }
            yield* drenar();
          }

          pageToken = res.nextPageToken || null;
          if (!pageToken) break;
          if (page < MAX_PAGINAS - 1 && !listoZona()) await sleep(PAUSA_PAGINA_MS);
        }
      }
    }
  } catch (e) {
    // Un corte fatal no deja conteos colgados en 'loading': se esperan y entregan antes de propagar.
    await Promise.all(pendientes.map(p => p.promise));
    yield* drenar();
    throw e;
  }

  await Promise.all(pendientes.map(p => p.promise));
  yield* drenar();
  yield { type: 'fin', totals: { ...totals } };
}
