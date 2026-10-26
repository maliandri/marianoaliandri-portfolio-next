import { describe, it, expect, vi } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn() }));
import { createFakeDb } from '@/test/fakeDb';
import { listProspectos, updateProspecto } from './igProspectosStore';

const ts = (n) => ({ __ts: n * 1000, toDate: () => new Date(n) });

function seed() {
  return createFakeDb({
    'ig_prospectos/pana': { handle: 'pana', nombre: 'Pana', estado: 'pendiente', updatedAt: ts(3) },
    'ig_prospectos/gomeria': { handle: 'gomeria', nombre: 'Gomería', estado: 'contactado', updatedAt: ts(2) },
    'ig_prospectos/kiosco': { handle: 'kiosco', nombre: 'Kiosco', estado: 'pendiente', updatedAt: ts(1) },
  });
}

describe('igProspectosStore', () => {
  it('lista filtrando por estado, más nuevos primero', async () => {
    const { db } = seed();
    const { items, nextCursor } = await listProspectos(db, { estado: 'pendiente' });
    expect(items.map(i => i.handle)).toEqual(['pana', 'kiosco']);
    expect(nextCursor).toBeNull();
  });

  it('pagina con cursor', async () => {
    const { db } = seed();
    const p1 = await listProspectos(db, { limit: 2 });
    expect(p1.items).toHaveLength(2);
    const p2 = await listProspectos(db, { limit: 2, cursor: p1.nextCursor });
    expect(p2.items.map(i => i.handle)).toEqual(['kiosco']);
  });

  it('estado inválido → 400; inexistente → 404', async () => {
    const { db } = seed();
    expect(await updateProspecto(db, 'pana', { estado: 'volando' })).toMatchObject({ status: 400 });
    expect(await updateProspecto(db, 'nadie', { estado: 'contactado' })).toMatchObject({ status: 404 });
    expect(await updateProspecto(db, 'MAL HANDLE', {})).toMatchObject({ status: 400 });
  });

  it('marcar contactado setea contactadoAt', async () => {
    const { db, docs } = seed();
    const r = await updateProspecto(db, 'pana', { estado: 'contactado', notas: 'le escribí' });
    expect(r.item.estado).toBe('contactado');
    expect(docs['ig_prospectos/pana'].contactadoAt).toBeTruthy();
    expect(docs['ig_prospectos/pana'].notas).toBe('le escribí');
  });
});
