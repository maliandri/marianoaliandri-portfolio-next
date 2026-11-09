import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS', delete: () => '__DEL__' } }));
vi.mock('@/lib/autoAuditRun', () => ({
  DRAFTS_COLLECTION: 'auditoria_auto_borradores', MIN_SITES_TO_PUBLISH: 3, publicarInforme: vi.fn(), loadConfig: vi.fn(async () => ({ emailAuto: false })),
}));
vi.mock('@/lib/autoAuditEmail', () => ({ enviarMailsAuditoria: vi.fn(async () => ({ enviados: 2, omitidos: {}, pausado: false })) }));

import { publicarInforme, loadConfig } from '@/lib/autoAuditRun';
import { enviarMailsAuditoria } from '@/lib/autoAuditEmail';
import { aprobarBorrador, descartarBorrador, listarBorradores, ReviewError } from './autoAuditReview.js';

const fila = (id, seoScore = 50) => ({ id, nombre: id, seoScore, siteUrl: `https://${id}.com` });

function createFakeDb(docs) {
  const store = Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, { ...v }]));
  const ref = (id) => ({
    async get() { return { exists: !!store[id], id, data: () => store[id] }; },
    async update(patch) {
      for (const [k, v] of Object.entries(patch)) { if (v === '__DEL__') delete store[id][k]; else store[id][k] = v; }
    },
  });
  return {
    store,
    collection: () => ({
      doc: ref,
      orderBy: () => ({ limit: () => ({ get: async () => ({
        docs: Object.entries(store).map(([id, d]) => ({ id, data: () => d })),
      }) }) }),
    }),
    runTransaction: async (fn) => fn({ get: (r) => r.get(), update: (r, p) => r.update(p) }),
  };
}

const BORRADOR = {
  estado: 'pendiente', creadoMs: 1000, networks: ['linkedin', 'instagram'],
  combo: { ciudad: 'Gran Mendoza', ciudades: ['Mendoza', 'Maipú'], rubro: { label: 'Ropa', prioritario: false } },
  results: [fila('a', 30), fila('b'), fila('c'), fila('farmacia')],
  busqueda: { encontrados: 39, examinados: 30, conWeb: 4 },
};

beforeEach(() => {
  vi.clearAllMocks();
  publicarInforme.mockResolvedValue({ estado: 'ok', auditoriaId: 'aud-9' });
});

describe('autoAuditReview', () => {
  it('lista solo los pendientes por default, con los conteos', async () => {
    const db = createFakeDb({ b1: BORRADOR, b2: { ...BORRADOR, estado: 'descartado' } });
    const items = await listarBorradores(db);
    expect(items.map(i => i.id)).toEqual(['b1']);
    expect(items[0]).toMatchObject({ rubro: 'Ropa', ciudad: 'Gran Mendoza', busqueda: { examinados: 30 }, stats: { total: 4 } });
  });

  it('aprobar: publica sin los excluidos, con la fecha de la corrida, y deja el borrador publicado', async () => {
    const db = createFakeDb({ b1: BORRADOR });
    const out = await aprobarBorrador(db, 'b1', { excluir: ['farmacia'], now: () => 5000 });
    expect(out).toMatchObject({ estado: 'ok', auditoriaId: 'aud-9', sitios: 3 });
    const arg = publicarInforme.mock.calls[0][0];
    expect(arg.results.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(arg).toMatchObject({ nowMs: 1000, redes: true, networks: ['linkedin', 'instagram'], combo: { ciudad: 'Gran Mendoza' } });
    expect(db.store.b1).toMatchObject({ estado: 'publicado', auditoriaId: 'aud-9', excluidos: ['farmacia'] });
    expect(db.store.b1.aprobandoMs).toBeUndefined();
  });

  it('aprobar manda los mails solo si emailAuto está prendido, y sin los excluidos', async () => {
    const db = createFakeDb({ b1: BORRADOR, b2: BORRADOR });
    await aprobarBorrador(db, 'b1');
    expect(enviarMailsAuditoria).not.toHaveBeenCalled();

    loadConfig.mockResolvedValueOnce({ emailAuto: true, emailTope: 10 });
    const out = await aprobarBorrador(db, 'b2', { excluir: ['farmacia'] });
    expect(enviarMailsAuditoria).toHaveBeenCalledTimes(1);
    const arg = enviarMailsAuditoria.mock.calls[0][1];
    expect(arg.results.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(arg.auditoriaId).toBe('aud-9');
    expect(out.mails).toMatchObject({ enviados: 2 });
  });

  it('aprobar sin redes y con otras redes', async () => {
    const db = createFakeDb({ b1: BORRADOR });
    await aprobarBorrador(db, 'b1', { redes: false, networks: ['facebook'] });
    expect(publicarInforme.mock.calls[0][0]).toMatchObject({ redes: false, networks: ['facebook'] });
  });

  it('dry_run no publica ni toca el borrador', async () => {
    const db = createFakeDb({ b1: BORRADOR });
    const out = await aprobarBorrador(db, 'b1', { dryRun: true, excluir: ['a'] });
    expect(out).toMatchObject({ dryRun: true, sitios: 3, excluidos: ['a'] });
    expect(publicarInforme).not.toHaveBeenCalled();
    expect(db.store.b1.estado).toBe('pendiente');
  });

  it('no publica si quedan menos de 3 sitios', async () => {
    const db = createFakeDb({ b1: BORRADOR });
    await expect(aprobarBorrador(db, 'b1', { excluir: ['a', 'b'] })).rejects.toThrow(ReviewError);
    expect(publicarInforme).not.toHaveBeenCalled();
  });

  it('no aprueba dos veces', async () => {
    const db = createFakeDb({ b1: { ...BORRADOR, estado: 'publicado' } });
    await expect(aprobarBorrador(db, 'b1')).rejects.toThrow('ya está publicado');
  });

  it('si publicar falla, el borrador vuelve a pendiente', async () => {
    publicarInforme.mockRejectedValueOnce(new Error('boom'));
    const db = createFakeDb({ b1: BORRADOR });
    await expect(aprobarBorrador(db, 'b1')).rejects.toThrow('boom');
    expect(db.store.b1.estado).toBe('pendiente');
  });

  it('descartar marca el motivo y no se puede aprobar después', async () => {
    const db = createFakeDb({ b1: BORRADOR });
    await descartarBorrador(db, 'b1', 'pocos sitios de ropa');
    expect(db.store.b1).toMatchObject({ estado: 'descartado', motivo: 'pocos sitios de ropa' });
    await expect(aprobarBorrador(db, 'b1')).rejects.toThrow('ya está descartado');
  });
});
