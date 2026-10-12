import { describe, it, expect, vi } from 'vitest';
import { searchLeads, parseZona, filasParaInforme, leadToAuditRow, isFatal, PAUSA_PAGINA_MS } from './leadSearch.js';

const WEB = { hasWebsite: true, siteUrl: 'https://x.test', seoScore: 40 };
const NADA = { hasWebsite: false, siteUrl: null, phone: '0299 442-1234', internationalPhone: '+54 299 442-1234' };
const CEL = { hasWebsite: false, siteUrl: null, internationalPhone: '+54 9 299 541-4422' };
const fatal = (code) => Object.assign(new Error(code), { code });

// places: { '<query o tipo>': [[ids página 0], [ids página 1]] } · audits: { id: audit | Error }
function fakeCall({ places = {}, audits = {}, geoError = {}, counts = {} } = {}) {
  const fn = vi.fn(async (action, p) => {
    if (action === 'geocode') {
      if (geoError[p.city]) throw geoError[p.city];
      return { ok: true, lat: 1, lon: 2 };
    }
    if (action === 'searchText' || action === 'searchNearby') {
      const pages = places[action === 'searchText' ? p.query : p.type] || [[]];
      const i = p.pageToken ? Number(p.pageToken) : 0;
      return {
        ok: true,
        places: pages[i].map(id => ({ id, displayName: { text: `N-${id}` }, location: { latitude: 3, longitude: 4 } })),
        nextPageToken: i + 1 < pages.length ? String(i + 1) : null,
      };
    }
    if (action === 'auditPlace') {
      const a = audits[p.placeId];
      if (a instanceof Error) throw a;
      return { ok: true, ...(a || NADA) };
    }
    if (action === 'countProducts') return counts[p.placeId] || { ok: true, applicable: true, count: 7, confidence: 'catalogo', partial: false };
    throw new Error(`acción inesperada ${action}`);
  });
  return fn;
}
const audited = (call) => call.mock.calls.filter(c => c[0] === 'auditPlace').map(c => c[1].placeId);
async function collect(gen) {
  const evs = [];
  try { for await (const e of gen) evs.push(e); } catch (error) { return { evs, error }; }
  return { evs, error: null };
}
const base = (over = {}) => ({ zonas: [{ ciudad: 'Neuquén', pais: 'Argentina' }], terminos: ['gomería'], tipos: [], radioKm: 10, cantidad: 10, ...over });
const deps = (call, over = {}) => ({ call, sleep: async () => {}, ...over });
const fin = (evs) => evs.find(e => e.type === 'fin').totals;
const leads = (evs) => evs.filter(e => e.type === 'lead').map(e => e.lead);

describe('searchLeads', () => {
  it('cantidad = leads entregados: corta al llegar, sin auditar de más', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c', 'd']] }, audits: { a: WEB, b: WEB, c: WEB, d: WEB } });
    const { evs } = await collect(searchLeads(base({ cantidad: 2 }), deps(call)));
    expect(leads(evs).map(l => l.id)).toEqual(['a', 'b']);
    expect(audited(call)).toEqual(['a', 'b']);
    expect(fin(evs)).toMatchObject({ encontrados: 4, examinados: 2, leads: 2, conWeb: 2, descartados: 0 });
  });

  it('los descartados no cuentan para la cantidad pero sí para el tope de examinados', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c']] }, audits: { a: NADA, b: WEB, c: CEL } });
    const { evs } = await collect(searchLeads(base({ cantidad: 2 }), deps(call)));
    expect(leads(evs).map(l => [l.id, l.canal])).toEqual([['b', 'web'], ['c', 'whatsapp']]);
    expect(leads(evs)[1].whatsapp).toBe('5492995414422');
    expect(evs.filter(e => e.type === 'descartado').map(e => e.negocio.id)).toEqual(['a']);
    expect(fin(evs)).toMatchObject({ examinados: 3, leads: 2, descartados: 1 });
  });

  it('maxExaminados por defecto es 3 × cantidad', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const call = fakeCall({ places: { 'gomería, Neuquén': [ids] } });
    const { evs } = await collect(searchLeads(base({ cantidad: 2 }), deps(call)));
    expect(audited(call)).toHaveLength(6);
    expect(fin(evs)).toMatchObject({ examinados: 6, leads: 0, descartados: 6 });
  });

  it('soloConWeb: un lead por WhatsApp cuenta como descartado', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b']] }, audits: { a: CEL, b: WEB } });
    const { evs } = await collect(searchLeads(base({ soloConWeb: true }), deps(call)));
    expect(leads(evs).map(l => l.id)).toEqual(['b']);
    expect(fin(evs).descartados).toBe(1);
  });

  it('tipos usan searchNearby con su etiqueta; un tipo con query usa searchText', async () => {
    const call = fakeCall({ places: { plumber: [['a']], 'constructora, Neuquén': [['b']] }, audits: { a: WEB, b: WEB } });
    const { evs } = await collect(searchLeads(base({
      terminos: [], tipos: [{ id: 'plumber', label: 'Plomero' }, { id: 'general_contractor', label: 'Constructor', query: 'constructora' }],
    }), deps(call)));
    expect(call).toHaveBeenCalledWith('searchNearby', expect.objectContaining({ type: 'plumber', radiusM: 10000 }));
    expect(leads(evs).map(l => [l.id, l.tipo])).toEqual([['a', 'Plomero'], ['b', 'Constructor']]);
  });

  it('no repite un negocio entre búsquedas ni entre zonas', async () => {
    const call = fakeCall({
      places: { 'gomería, Neuquén': [['a', 'b']], 'neumáticos, Neuquén': [['b', 'c']], 'gomería, Plottier': [['a', 'd']], 'neumáticos, Plottier': [[]] },
      audits: { a: WEB, b: WEB, c: WEB, d: WEB },
    });
    const { evs } = await collect(searchLeads(base({
      zonas: [{ ciudad: 'Neuquén', pais: 'Argentina' }, { ciudad: 'Plottier', pais: 'Argentina' }], terminos: ['gomería', 'neumáticos'],
    }), deps(call)));
    expect(audited(call)).toEqual(['a', 'b', 'c', 'd']);
    expect(fin(evs).encontrados).toBe(4);
  });

  it('pagina hasta 3 veces con pausa entre páginas', async () => {
    const sleep = vi.fn(async () => {});
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a'], ['b'], ['c'], ['d']] }, audits: { a: WEB, b: WEB, c: WEB, d: WEB } });
    const { evs } = await collect(searchLeads(base(), deps(call, { sleep })));
    expect(leads(evs).map(l => l.id)).toEqual(['a', 'b', 'c']); // la 4ª página no se pide
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(PAUSA_PAGINA_MS);
  });

  it('cancelar: termina el negocio en curso y no audita más', async () => {
    let cancel = false;
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c']] }, audits: { a: WEB, b: WEB, c: WEB } });
    const evs = [];
    for await (const e of searchLeads(base(), deps(call, { isCancelled: () => cancel }))) {
      evs.push(e);
      if (e.type === 'negocio') cancel = true; // se cancela mientras "a" se audita
    }
    expect(audited(call)).toEqual(['a']);
    expect(leads(evs).map(l => l.id)).toEqual(['a']);
    expect(evs.at(-1).type).toBe('fin');
  });

  it('un error fatal corta todo pero los leads ya entregados quedan', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b', 'c']] }, audits: { a: WEB, b: fatal('NO_PLAN'), c: WEB } });
    const { evs, error } = await collect(searchLeads(base(), deps(call)));
    expect(error.code).toBe('NO_PLAN');
    expect(leads(evs).map(l => l.id)).toEqual(['a']);
    expect(audited(call)).toEqual(['a', 'b']);
  });

  it('un error fatal después de emitir leads con conteo pendiente igual entrega el conteo', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b']] }, audits: { a: WEB, b: fatal('DISCARD_LIMIT') } });
    const { evs, error } = await collect(searchLeads(base({ perfil: 'empresa', producto: 'cubierta' }), deps(call)));
    expect(error.code).toBe('DISCARD_LIMIT');
    expect(evs.find(e => e.type === 'productos' && e.id === 'a')).toMatchObject({ prodState: 'done' });
  });

  it('una ciudad que no se ubica avisa y sigue con la próxima', async () => {
    const call = fakeCall({
      places: { 'gomería, Plottier': [['a']] }, audits: { a: WEB },
      geoError: { Atlantis: new Error('no existe') },
    });
    const { evs, error } = await collect(searchLeads(base({
      zonas: [{ ciudad: 'Atlantis', pais: '' }, { ciudad: 'Plottier', pais: 'Argentina' }],
    }), deps(call)));
    expect(error).toBeNull();
    expect(evs.find(e => e.type === 'aviso').mensaje).toContain('Atlantis');
    expect(leads(evs).map(l => l.id)).toEqual(['a']);
  });

  it('un negocio que no se pudo auditar avisa con su id y sigue', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b']] }, audits: { a: new Error('timeout'), b: WEB } });
    const { evs } = await collect(searchLeads(base(), deps(call)));
    expect(evs.find(e => e.type === 'aviso')).toMatchObject({ negocioId: 'a' });
    expect(leads(evs).map(l => l.id)).toEqual(['b']);
  });

  it('perfil empresa: cuenta productos solo de los leads con web y entrega el conteo antes del fin', async () => {
    const call = fakeCall({ places: { 'gomería, Neuquén': [['a', 'b']] }, audits: { a: WEB, b: CEL } });
    const { evs } = await collect(searchLeads(base({ perfil: 'empresa', producto: ' cubierta ' }), deps(call)));
    expect(call).toHaveBeenCalledWith('countProducts', { placeId: 'a', keyword: 'cubierta' });
    expect(call.mock.calls.filter(c => c[0] === 'countProducts')).toHaveLength(1);
    expect(leads(evs)[0].prodState).toBe('loading');
    const iProd = evs.findIndex(e => e.type === 'productos');
    expect(evs[iProd]).toMatchObject({ id: 'a', prodState: 'done', prodCount: 7, prodConfidence: 'catalogo' });
    expect(iProd).toBeLessThan(evs.findIndex(e => e.type === 'fin'));
  });

  it('usa la clasificación del server si viene; si no (historial viejo), la calcula', async () => {
    const call = fakeCall({
      places: { 'gomería, Neuquén': [['a', 'b']] },
      audits: { a: { ...WEB, esLead: false, canal: null }, b: CEL },
    });
    const { evs } = await collect(searchLeads(base(), deps(call)));
    expect(leads(evs).map(l => l.id)).toEqual(['b']);
  });
});

describe('isFatal', () => {
  it('reconoce los códigos que cortan la búsqueda', () => {
    for (const c of ['NO_AUTH', 'NO_PLAN', 'QUOTA_EXCEEDED', 'DISCARD_LIMIT']) expect(isFatal(fatal(c))).toBe(true);
    expect(isFatal(new Error('x'))).toBe(false);
  });
});

describe('parseZona', () => {
  it('separa ciudad y país por la última coma', () => {
    expect(parseZona('Neuquén, Argentina')).toEqual({ ciudad: 'Neuquén', pais: 'Argentina' });
    expect(parseZona('San Carlos de Bariloche, Río Negro, Argentina')).toEqual({ ciudad: 'San Carlos de Bariloche, Río Negro', pais: 'Argentina' });
  });
  it('sin coma devuelve país vacío', () => {
    expect(parseZona(' Neuquén ')).toEqual({ ciudad: 'Neuquén', pais: '' });
  });
});

describe('filasParaInforme / leadToAuditRow', () => {
  const lead = { id: 'a', nombre: 'A', ciudad: 'Neuquén', tipo: 'Gomería', lat: 1, lon: 2, siteUrl: 'https://a.test', email: 'a@a.test',
    seoScore: 30, hasSitemap: true, hasRobots: false, metaDesc: null, hasOG: false, lastUpdated: '2025-01-01', rating: 4.5, canal: 'web', phone: '123' };

  it('solo leads con web y puntaje SEO, sin teléfono', () => {
    const filas = filasParaInforme([lead, { ...lead, id: 'b', seoScore: null }, { ...lead, id: 'c', canal: 'whatsapp' }]);
    expect(filas.map(f => f.id)).toEqual(['a']);
    expect(filas[0]).toEqual(leadToAuditRow(lead));
    expect(filas[0].phone).toBeUndefined();
    expect(filas[0].lastModified).toBe('2025-01-01');
  });
});
