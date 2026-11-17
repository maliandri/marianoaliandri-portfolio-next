import { describe, it, expect, vi } from 'vitest';
import { estadoEfectivo, crearRegistrador, STALE_MS } from './agentRuns';
import { armarFilas } from './agentRunView';

function fakeDb({ falla = false } = {}) {
  const sets = [];
  const update = vi.fn(async () => { /* cierre */ });
  const set = vi.fn(async (doc) => { if (falla) throw new Error('firestore caído'); sets.push(doc); });
  const eventos = { doc: vi.fn(id => ({ set: (d) => set({ id, ...d }) })) };
  const runRef = { collection: vi.fn(() => eventos), update };
  return { db: { collection: vi.fn(() => ({ doc: vi.fn(() => runRef) })) }, sets, update, set };
}

describe('estadoEfectivo', () => {
  it('una corrida "corriendo" que pasó el tiempo máximo quedó cortada', () => {
    const run = { estado: 'corriendo', creadoMs: 1000 };
    expect(estadoEfectivo(run, 1000 + 60_000)).toBe('corriendo');
    expect(estadoEfectivo(run, 1000 + STALE_MS + 1)).toBe('cortado');
  });
  it('los estados finales no cambian', () => {
    expect(estadoEfectivo({ estado: 'listo', creadoMs: 0 }, 99_999_999)).toBe('listo');
    expect(estadoEfectivo({ estado: 'error', creadoMs: 0 }, 99_999_999)).toBe('error');
    expect(estadoEfectivo(null)).toBe('desconocido');
  });
});

describe('crearRegistrador', () => {
  it('numera los eventos en orden y con id ordenable', async () => {
    const { db, sets } = fakeDb();
    const r = crearRegistrador(db, 'run1', { now: () => 5 });
    r.evento({ tipo: 'inicio', texto: 'a' });
    r.evento({ tipo: 'modelo', texto: 'b' });
    await r.cerrar({ estado: 'listo' });
    expect(sets.map(s => [s.id, s.seq, s.tipo])).toEqual([['0001', 1, 'inicio'], ['0002', 2, 'modelo']]);
  });
  it('recorta textos largos para no inflar Firestore', async () => {
    const { db, sets } = fakeDb();
    const r = crearRegistrador(db, 'run1');
    r.evento({ tipo: 'texto', texto: 'x'.repeat(2000), resumen: 'y'.repeat(2000) });
    await r.cerrar({ estado: 'listo' });
    expect(sets[0].texto.length).toBeLessThan(700);
    expect(sets[0].resumen.length).toBeLessThan(400);
  });
  it('cerrar espera a que todos los eventos estén guardados antes de marcar el fin', async () => {
    const { db, update, set } = fakeDb();
    const orden = [];
    set.mockImplementation(async () => { await new Promise(r => setTimeout(r, 10)); orden.push('set'); });
    update.mockImplementation(async () => { orden.push('update'); });
    const r = crearRegistrador(db, 'run1');
    r.evento({ tipo: 'a' }); r.evento({ tipo: 'b' });
    await r.cerrar({ estado: 'listo', texto: 'ok', borradores: [{ draftId: 'd1' }], pasos: 2 });
    expect(orden).toEqual(['set', 'set', 'update']);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ estado: 'listo', texto: 'ok', pasos: 2 }));
  });
  it('si Firestore falla al guardar un evento no corta la corrida', async () => {
    const { db, update } = fakeDb({ falla: true });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = crearRegistrador(db, 'run1');
    r.evento({ tipo: 'a' });
    await expect(r.cerrar({ estado: 'listo' })).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
    err.mockRestore();
  });
  it('tiene un tope de eventos por corrida', async () => {
    const { db, sets } = fakeDb();
    const r = crearRegistrador(db, 'run1');
    for (let i = 0; i < 400; i++) r.evento({ tipo: 'x' });
    await r.cerrar({ estado: 'listo' });
    expect(sets.length).toBe(300);
  });
});

describe('armarFilas', () => {
  it('une inicio y fin de cada herramienta en una sola fila', () => {
    const filas = armarFilas([
      { seq: 1, tipo: 'inicio', texto: 'obj' },
      { seq: 2, tipo: 'herramienta', fase: 'inicio', id: 1, tool: 'search_leads', args: { cantidad: 5 } },
      { seq: 3, tipo: 'herramienta', fase: 'inicio', id: 2, tool: 'esperar', args: { segundos: 15 } },
      { seq: 4, tipo: 'herramienta', fase: 'fin', id: 1, tool: 'search_leads', ok: true, resumen: 'lanzada', ms: 900 },
    ]);
    expect(filas).toHaveLength(3);
    expect(filas[1]).toMatchObject({ tool: 'search_leads', fase: 'fin', ok: true, resumen: 'lanzada', ms: 900 });
    expect(filas[2]).toMatchObject({ tool: 'esperar', fase: 'inicio' }); // sigue en curso
  });
  it('tolera una lista vacía', () => {
    expect(armarFilas()).toEqual([]);
  });
});
