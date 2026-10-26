import { describe, it, expect } from 'vitest';
import { createFakeDb, firestoreMock } from './fakeDb';

const { FieldValue } = firestoreMock;

describe('createFakeDb', () => {
  it('filtra, ordena y limita una colección', async () => {
    const { db } = createFakeDb({
      'p/a': { estado: 'pendiente', updatedAt: 1 },
      'p/b': { estado: 'pendiente', updatedAt: 3 },
      'p/c': { estado: 'contactado', updatedAt: 4 },
      'p/d': { estado: 'pendiente', updatedAt: 2 },
    });
    const snap = await db.collection('p').where('estado', '==', 'pendiente').orderBy('updatedAt', 'desc').limit(2).get();
    expect(snap.docs.map(d => d.id)).toEqual(['b', 'd']);
    expect(snap.size).toBe(2);
  });

  it('pagina con startAfter', async () => {
    const { db } = createFakeDb({ 'p/a': { n: 1 }, 'p/b': { n: 2 }, 'p/c': { n: 3 } });
    const snap = await db.collection('p').orderBy('n', 'desc').startAfter(3).limit(5).get();
    expect(snap.docs.map(d => d.data().n)).toEqual([2, 1]);
  });

  it('filtra por id con __name__', async () => {
    const { db } = createFakeDb({ 'u/2026-09-30': { x: 1 }, 'u/2026-10-01': { x: 2 }, 'u/2026-10-31': { x: 3 } });
    const snap = await db.collection('u').where('__name__', '>=', '2026-10-01').where('__name__', '<=', '2026-10-31').get();
    expect(snap.docs.map(d => d.id)).toEqual(['2026-10-01', '2026-10-31']);
  });

  it('add crea un doc con id y subcolecciones anidadas', async () => {
    const { db, docs } = createFakeDb();
    const ref = await db.collection('s').doc('u1').collection('items').add({ a: 1 });
    expect(docs[`s/u1/items/${ref.id}`]).toEqual({ a: 1 });
  });

  it('suma con increment dentro de una transacción', async () => {
    const { db, docs } = createFakeDb({ 'c/x': { n: 2 } });
    await db.runTransaction(async tx => {
      const ref = db.collection('c').doc('x');
      const snap = await tx.get(ref);
      tx.set(ref, { n: FieldValue.increment(3), seen: snap.data().n }, { merge: true });
    });
    expect(docs['c/x']).toEqual({ n: 5, seen: 2 });
  });

  it('serverTimestamp queda como Timestamp ordenable', async () => {
    const { db } = createFakeDb();
    await db.collection('t').doc('a').set({ at: FieldValue.serverTimestamp() });
    await db.collection('t').doc('b').set({ at: FieldValue.serverTimestamp() });
    const snap = await db.collection('t').orderBy('at', 'desc').get();
    expect(snap.docs.map(d => d.id)).toEqual(['b', 'a']);
    expect(snap.docs[0].data().at.toDate()).toBeInstanceOf(Date);
  });

  it('update falla si el doc no existe y delete lo borra', async () => {
    const { db, docs } = createFakeDb({ 'd/a': { x: 1 } });
    await expect(db.collection('d').doc('nope').update({ x: 2 })).rejects.toThrow();
    await db.collection('d').doc('a').update({ y: 2 });
    expect(docs['d/a']).toEqual({ x: 1, y: 2 });
    await db.collection('d').doc('a').delete();
    expect(docs['d/a']).toBeUndefined();
  });
});
