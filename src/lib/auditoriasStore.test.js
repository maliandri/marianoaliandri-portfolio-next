import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

import { getDb } from '@/lib/firebase-admin';
import { callGemini } from '@/lib/geminiClient';
import { saveAuditoria } from './auditoriasStore.js';

function fakeDb() {
  const added = [];
  return {
    added,
    collection: (name) => ({ add: async (doc) => { added.push({ name, doc }); return { id: 'new-id' }; } }),
  };
}

const config = { ciudades: ['Mendoza'], tiposLabels: ['Ferretería'] };
const stats = { total: 2, avgSeoScore: 40, lowSeoCount: 1, withEmail: 1 };
const results = [
  { id: 'p1', nombre: 'A', ciudad: 'Mendoza', tipo: 'Ferretería', rubro: 'Ferretería', aptoSistemaMedida: true,
    siteUrl: 'https://a.com', email: 'a@a.com', seoScore: 30, direccion: 'Calle 1', telefono: '123' },
  { id: 'p2', nombre: 'B', siteUrl: 'https://b.com', seoScore: 50 },
];

beforeEach(() => vi.clearAllMocks());

describe('saveAuditoria', () => {
  it('guarda rubro y aptoSistemaMedida y descarta dirección y teléfono', async () => {
    const db = fakeDb();
    getDb.mockReturnValue(db);
    const r = await saveAuditoria({ title: 'T', config, results, stats, summary: 'ya escrito' });
    expect(r.id).toBe('new-id');
    const saved = db.added[0].doc.results;
    expect(saved[0]).toMatchObject({ rubro: 'Ferretería', aptoSistemaMedida: true, email: 'a@a.com' });
    expect(saved[0]).not.toHaveProperty('direccion');
    expect(saved[0]).not.toHaveProperty('telefono');
    expect(saved[1]).toMatchObject({ rubro: null, aptoSistemaMedida: false });
  });

  it('usa el summary provisto sin llamar a Gemini', async () => {
    getDb.mockReturnValue(fakeDb());
    const r = await saveAuditoria({ title: 'T', config, results, stats, summary: '  texto editado  ' });
    expect(r.summary).toBe('texto editado');
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('genera el resumen con Gemini si no viene', async () => {
    getDb.mockReturnValue(fakeDb());
    callGemini.mockResolvedValue('Resumen de Gemini');
    const r = await saveAuditoria({ title: 'T', config, results, stats });
    expect(r.summary).toBe('Resumen de Gemini');
  });

  it('si Gemini falla usa la plantilla con los datos reales (no rompe el guardado)', async () => {
    const db = fakeDb();
    getDb.mockReturnValue(db);
    callGemini.mockRejectedValue(new Error('Todas las Gemini API keys agotaron su cuota (429)'));
    const r = await saveAuditoria({ title: 'T', config, results, stats });
    expect(r.id).toBe('new-id');
    expect(r.summary).toContain('Mendoza');
    expect(r.summary).toContain('50%');
    expect(db.added[0].doc.summary).toBe(r.summary);
  });

  it('lanza si no hay Firestore', async () => {
    getDb.mockReturnValue(null);
    await expect(saveAuditoria({ title: 'T', config, results, stats })).rejects.toThrow('DB no disponible');
  });
});
