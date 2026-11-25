import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
const { createFakeDb } = await import('@/test/fakeDb');
const { crearSolicitud, MEET_MINUTOS } = await import('./tiendaSolicitud');
const { normalizarItem } = await import('@/lib/tienda');

const catalogo = [
  normalizarItem('base_sitio', { label: 'Base del sitio', tipo: 'base', priceUSD: 150 }),
  normalizarItem('catalogo_productos', { label: 'Catálogo', priceUSD: 400, requiere: ['base_sitio'] }),
  normalizarItem('carrito', { label: 'Carrito', priceUSD: 250, requiere: ['catalogo_productos'] }),
];
const user = { uid: 'u1', email: 'cli@x.com' };
const cliente = { nombre: 'Mónica', email: 'cli@x.com', telefono: '299 555', empresa: 'Deco', notas: 'quiero vender online' };
const deps = (extra = {}) => ({ user, now: () => 1_000, cargar: async () => catalogo, turnoValido: async () => true, avisar: vi.fn(async () => {}), ...extra });

describe('crearSolicitud', () => {
  it('sin sesión → 401', async () => {
    const r = await crearSolicitud(createFakeDb().db, { servicios: ['carrito'], cliente }, deps({ user: null }));
    expect(r.status).toBe(401);
  });

  it('sin servicios o con uno inexistente → 400', async () => {
    expect((await crearSolicitud(createFakeDb().db, { servicios: [], cliente }, deps())).status).toBe(400);
    expect((await crearSolicitud(createFakeDb().db, { servicios: ['inventado'], cliente }, deps())).status).toBe(400);
  });

  it('con un turno que ya no está libre → 409', async () => {
    const r = await crearSolicitud(createFakeDb().db, { servicios: ['carrito'], cliente, meet: { inicio: '2026-11-26T13:00:00.000Z' } }, deps({ turnoValido: async () => false }));
    expect(r).toMatchObject({ status: 409, error: 'Ese horario ya no está libre' });
  });

  it('caso feliz: guarda la solicitud sin montos, con dependencias, meet pedido y avisa', async () => {
    const db = createFakeDb().db;
    const d = deps();
    const chat = [{ rol: 'cliente', texto: '¿Puedo cargar los productos yo?' }, { rol: 'asistente', texto: 'Sí.' }];
    const r = await crearSolicitud(db, { servicios: ['carrito'], cliente, chat, meet: { inicio: '2026-11-26T13:00:00.000Z' }, sesionId: 's1' }, d);
    expect(r.status).toBe(201);
    const doc = (await db.collection('presupuestos').doc(r.id).get()).data();
    expect(Object.keys(doc).filter(k => /USD|ARS|price|monto/i.test(k))).toEqual([]);
    expect(doc).toMatchObject({ origen: 'tienda', source: 'tienda', status: 'pending', userId: 'u1', clientName: 'Mónica', sesionId: 's1' });
    expect(doc.servicioIds).toEqual(['carrito', 'catalogo_productos', 'base_sitio']);
    expect(doc.selectedServices).toEqual(['Carrito', 'Catálogo', 'Base del sitio']);
    expect(doc.meet).toEqual({ estado: 'pedido', inicio: '2026-11-26T13:00:00.000Z', fin: new Date(Date.parse('2026-11-26T13:00:00.000Z') + MEET_MINUTOS * 60000).toISOString() });
    expect(doc.chat).toEqual(chat);
    expect(d.avisar).toHaveBeenCalledTimes(1);
    expect(d.avisar).toHaveBeenCalledWith(r.id);
  });

  it('sin meet queda sin_meet; el chat se recorta', async () => {
    const db = createFakeDb().db;
    const chat = Array.from({ length: 30 }, (_, i) => ({ rol: 'cliente', texto: 'x'.repeat(900) + i }));
    const r = await crearSolicitud(db, { servicios: ['base_sitio'], cliente, chat }, deps());
    const doc = (await db.collection('presupuestos').doc(r.id).get()).data();
    expect(doc.meet).toEqual({ estado: 'sin_meet', inicio: null, fin: null });
    expect(doc.chat).toHaveLength(20);
    expect(doc.chat[0].texto.length).toBe(500);
  });

  it('un error al avisar no rompe la solicitud', async () => {
    const r = await crearSolicitud(createFakeDb().db, { servicios: ['base_sitio'], cliente }, deps({ avisar: async () => { throw new Error('telegram caído'); } }));
    expect(r.status).toBe(201);
  });
});


