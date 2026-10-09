import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/autoAuditBatch', () => ({ runBatch: vi.fn() }));
vi.mock('@/lib/auditoriasStore', () => ({ saveAuditoria: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

import { getDb } from '@/lib/firebase-admin';
import { runBatch } from '@/lib/autoAuditBatch';
import { saveAuditoria } from '@/lib/auditoriasStore';
import { runAutoAudit, loadConfig, defaultConfig } from './autoAuditRun.js';
import { comboKey } from './autoAudit.js';

const NOW = Date.UTC(2026, 9, 9);
const RUBRO = { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true };
const COMBO_KEY = comboKey('Neuquén', RUBRO);
const BASE_CONFIG = {
  activo: true, ciudades: ['Neuquén'], rubros: [RUBRO],
  networks: ['linkedin', 'instagram', 'facebook'], imageUrl: 'https://img/x.jpg', ultimaCorrida: {},
};

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v;
  }
  return out;
}

// Firestore falso: doc de config + colección de runs + transacciones.
function createFakeDb(initialConfig) {
  const state = { config: initialConfig, runs: [], setCalls: [] };
  const configRef = {
    async get() { return { exists: state.config !== undefined, data: () => state.config }; },
    async set(patch) {
      state.setCalls.push(patch);
      state.config = merge(state.config || {}, patch);
    },
  };
  return {
    state,
    collection: (name) => (name === 'auditoria_auto_runs'
      ? { add: async (doc) => { state.runs.push(doc); return { id: `run-${state.runs.length}` }; } }
      : { doc: () => configRef }),
    runTransaction: async (fn) => fn({ get: (ref) => ref.get(), set: (ref, patch) => ref.set(patch) }),
  };
}

const results = [
  { id: 'a', nombre: 'A', seoScore: 30, email: 'a@a.com' },
  { id: 'b', nombre: 'B', seoScore: 70, email: null },
];

let fetchMock;
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  runBatch.mockResolvedValue({ results, status: 'ok', examined: 2 });
  saveAuditoria.mockResolvedValue({ id: 'aud-1', summary: 'Resumen guardado' });
});
afterEach(() => vi.unstubAllGlobals());

describe('loadConfig / defaultConfig', () => {
  it('sin doc usa la semilla y arranca apagada', async () => {
    const db = createFakeDb(undefined);
    const cfg = await loadConfig(db);
    expect(cfg.activo).toBe(false);
    expect(cfg.ciudades.length).toBeGreaterThan(30);
    expect(cfg.rubros.some(r => r.prioritario)).toBe(true);
    expect(cfg.networks).toEqual(['linkedin', 'instagram', 'facebook']);
    expect(defaultConfig().activo).toBe(false);
  });

  it('un doc que solo tiene el lock sigue usando la semilla para ciudades/rubros', async () => {
    const db = createFakeDb({ lock: { until: 0 } });
    const cfg = await loadConfig(db);
    expect(cfg.activo).toBe(false);
    expect(cfg.ciudades.length).toBeGreaterThan(30);
  });
});

describe('runAutoAudit — guardas', () => {
  it('primera corrida sin config: no audita ni publica (arranca apagada)', async () => {
    const db = createFakeDb(undefined);
    getDb.mockReturnValue(db);
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toEqual({ skipped: 'inactivo' });
    expect(runBatch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('activo:false → skipped inactivo', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, activo: false }));
    expect(await runAutoAudit({ now: () => NOW })).toEqual({ skipped: 'inactivo' });
    expect(runBatch).not.toHaveBeenCalled();
  });

  it('force ignora activo:false', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, activo: false }));
    const out = await runAutoAudit({ force: true, now: () => NOW });
    expect(out.estado).toBe('ok');
    expect(runBatch).toHaveBeenCalled();
  });

  it('candado vigente → skipped en_curso, sin tocar nada', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, lock: { until: NOW + 60000 } }));
    expect(await runAutoAudit({ now: () => NOW })).toEqual({ skipped: 'en_curso' });
    expect(runBatch).not.toHaveBeenCalled();
  });

  it('candado vencido se puede retomar', async () => {
    getDb.mockReturnValue(createFakeDb({ ...BASE_CONFIG, lock: { until: NOW - 1 } }));
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('ok');
  });

  it('sin combinaciones disponibles → skipped sin_combos y libera el candado', async () => {
    const db = createFakeDb({ ...BASE_CONFIG, ultimaCorrida: { [COMBO_KEY]: NOW } });
    getDb.mockReturnValue(db);
    expect(await runAutoAudit({ now: () => NOW })).toEqual({ skipped: 'sin_combos' });
    expect(db.state.config.lock.until).toBe(0);
  });
});

describe('runAutoAudit — flujo', () => {
  it('ok: guarda, publica en Make con agregados, registra el run, marca la combinación y libera el candado', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    const out = await runAutoAudit({ now: () => NOW });

    expect(out).toMatchObject({ estado: 'ok', auditoriaId: 'aud-1', auditados: 2 });
    expect(saveAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      results,
      stats: { total: 2, avgSeoScore: 50, lowSeoCount: 1, withEmail: 1 },
      config: expect.objectContaining({ ciudades: ['Neuquén'], tiposLabels: ['Ferretería'], pais: 'Argentina' }),
    }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe('keyword_report');
    expect(body.networks).toEqual(['linkedin', 'instagram', 'facebook']);
    expect(body.imageUrl).toBe('https://img/x.jpg');
    expect(body.text).toContain('/auditorias/aud-1');
    expect(body.text).not.toContain('"nombre"');

    expect(db.state.runs).toHaveLength(1);
    expect(db.state.runs[0]).toMatchObject({ estado: 'ok', auditoriaId: 'aud-1', combo: { ciudad: 'Neuquén', rubro: 'Ferretería' } });
    expect(db.state.config.ultimaCorrida[COMBO_KEY]).toBe(NOW);
    expect(db.state.config.lock.until).toBe(0);
  });

  it('pasa budgetMs/maxSites/maxCandidates al lote', async () => {
    getDb.mockReturnValue(createFakeDb(BASE_CONFIG));
    await runAutoAudit({ now: () => NOW, budgetMs: 480000, maxSites: 30, maxCandidates: 60 });
    expect(runBatch).toHaveBeenCalledWith(
      expect.objectContaining({ ciudad: 'Neuquén' }),
      { budgetMs: 480000, maxSites: 30, maxCandidates: 60 },
    );
  });

  it('sin resultados: no guarda ni publica, pero marca la combinación', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockResolvedValue({ results: [], status: 'ok', examined: 5 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('sin_resultados');
    expect(saveAuditoria).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.ultimaCorrida[COMBO_KEY]).toBe(NOW);
    expect(db.state.config.lock.until).toBe(0);
  });

  it('error de geocodificación: estado error, NO marca la combinación, no publica', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockResolvedValue({ results: [], status: 'error', error: 'Ciudad no encontrada: Neuquén', examined: 0 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('error');
    expect(out.error).toContain('Ciudad no encontrada');
    expect(db.state.config.ultimaCorrida?.[COMBO_KEY]).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.lock.until).toBe(0);
  });

  it('cuota agotada con pocos resultados: no guarda, no publica, no marca', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockResolvedValue({ results: results.slice(0, 1), status: 'cuota_agotada', examined: 2 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('cuota_agotada');
    expect(saveAuditoria).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.ultimaCorrida?.[COMBO_KEY]).toBeUndefined();
  });

  it('cuota agotada con 5 o más resultados: guarda el informe pero NO publica en redes', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, seoScore: 40, email: null }));
    runBatch.mockResolvedValue({ results: many, status: 'cuota_agotada', examined: 6 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'cuota_agotada', auditoriaId: 'aud-1' });
    expect(saveAuditoria).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.state.config.lock.until).toBe(0);
  });

  it('Make responde no-2xx: el informe queda guardado y el run queda post_fallido', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'post_fallido', auditoriaId: 'aud-1' });
    expect(out.error).toContain('500');
    expect(db.state.config.ultimaCorrida[COMBO_KEY]).toBe(NOW);
    expect(db.state.config.lock.until).toBe(0);
  });

  it('Make lanza excepción: post_fallido y se libera el candado', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    fetchMock.mockRejectedValue(new Error('network down'));
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'post_fallido', auditoriaId: 'aud-1' });
    expect(out.error).toContain('network down');
    expect(db.state.config.lock.until).toBe(0);
  });

  it('excepción inesperada en el lote: estado error y se libera el candado', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockRejectedValue(new Error('explotó'));
    const out = await runAutoAudit({ now: () => NOW });
    expect(out).toMatchObject({ estado: 'error', error: 'explotó' });
    expect(db.state.runs[0].estado).toBe('error');
    expect(db.state.config.lock.until).toBe(0);
  });

  it('lanza si no hay Firestore', async () => {
    getDb.mockReturnValue(null);
    await expect(runAutoAudit({ now: () => NOW })).rejects.toThrow('DB no disponible');
  });

  it('config write falla una vez luego sucede: resultado devuelto, candado liberado, combo marcado', async () => {
    const db = createFakeDb(BASE_CONFIG);
    let failCount = 0;
    const originalSet = db.collection('auditoria_auto').doc('config').set;
    db.collection('auditoria_auto').doc('config').set = async function(patch) {
      // Solo fallar en el segundo set (el del finally, no el del lock)
      if (Object.keys(patch).includes('ultimaCorrida') && failCount === 0) {
        failCount++;
        throw new Error('Firestore transient error');
      }
      return originalSet.call(this, patch);
    };
    getDb.mockReturnValue(db);

    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('ok');
    expect(db.state.config.lock.until).toBe(0);
    expect(db.state.config.ultimaCorrida[COMBO_KEY]).toBe(NOW);
  });

  it('config write siempre falla: runAutoAudit resuelve con el estado computado, falla logueada', async () => {
    const db = createFakeDb(BASE_CONFIG);
    const originalSet = db.collection('auditoria_auto').doc('config').set;
    db.collection('auditoria_auto').doc('config').set = async function(patch) {
      // Solo fallar en el segundo set (el del finally)
      if (Object.keys(patch).includes('ultimaCorrida')) {
        throw new Error('Firestore permanently down');
      }
      return originalSet.call(this, patch);
    };
    getDb.mockReturnValue(db);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('ok');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[auto-audit] no se pudo liberar el candado'),
      expect.stringContaining('Firestore permanently down'),
    );
    consoleError.mockRestore();
  });

  it('batch error sin mensaje: registra "error desconocido"', async () => {
    const db = createFakeDb(BASE_CONFIG);
    getDb.mockReturnValue(db);
    runBatch.mockResolvedValue({ results: [], status: 'error', error: undefined, examined: 0 });
    const out = await runAutoAudit({ now: () => NOW });
    expect(out.estado).toBe('error');
    expect(out.error).toBe('error desconocido');
    expect(db.state.runs[0].error).toBe('error desconocido');
  });
});
