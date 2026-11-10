import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from '@/test/fakeDb';
import { catalogoEfectivo, agruparCatalogo, sinPrecios, normalizarItem, cotizar, validarCliente } from './tienda';
import { resolverDependencias } from './tiendaDeps';
import { dolarOficialVenta, _resetDolarCache } from './dolar';
import { checkoutTienda, cargarCatalogo } from './tiendaCheckout';
import { sembrarCatalogo, validarPieza, actualizarCampos } from './tiendaCatalogo';

// Catálogo chico a mano para probar la cuenta sin depender de los precios reales del código.
const pieza = (id, priceUSD, extra = {}) => normalizarItem(id, { categoria: 'T', label: id.toUpperCase(), priceUSD, ...extra });
const catalogo = [
  pieza('base', 150),
  pieza('sec', 50, { tipo: 'seccion', requiere: ['base'] }),
  pieza('pag', 100, { tipo: 'seccion', requiere: ['base'], porUnidad: true }),
  pieza('db1', 180), pieza('db2', 180),
  pieza('crm', 500, { requiere: ['base', 'db1|db2'] }),
  pieza('viejo', 300, { activo: false }),
  pieza('huerfano', 10, { requiere: ['no_existe'] }),
];
const cliente = { nombre: 'Ana', email: 'Ana@Mail.com', telefono: '299 1234567' };

describe('tienda: precios del catálogo', () => {
  it('el precio editado en el admin pisa el del código', () => {
    const items = catalogoEfectivo({ payments_mp: { priceUSD: 500 } });
    expect(items.find(s => s.id === 'payments_mp').priceUSD).toBe(500);
    expect(catalogoEfectivo().find(s => s.id === 'payments_mp').priceUSD).toBe(250);
  });

  it('los paquetes viejos quedan desactivados y no salen en la lista agrupada', () => {
    const items = catalogoEfectivo();
    for (const id of ['landing', 'web_business', 'ecommerce', 'webapp']) expect(items.find(s => s.id === id).activo).toBe(false);
    const ids = agruparCatalogo(items).flatMap(c => c.items.map(s => s.id));
    expect(ids).not.toContain('ecommerce');
    expect(ids).toContain('base_sitio');
    expect(agruparCatalogo(items)[0].category).toMatch(/Base/);
  });

  it('la versión pública no lleva ningún precio', () => {
    const pub = sinPrecios(catalogoEfectivo());
    expect(pub.length).toBeGreaterThan(40);
    expect(pub.every(s => !('priceUSD' in s) && !('price' in s))).toBe(true);
    expect(JSON.stringify(pub)).not.toMatch(/priceUSD/);
  });

  it('el catálogo del código es coherente: todo lo que se requiere existe y las dependencias terminan', () => {
    const items = catalogoEfectivo();
    const ids = new Set(items.map(s => s.id));
    for (const s of items) {
      for (const req of s.requiere) {
        const alts = req.split('|');
        expect(alts.some(a => ids.has(a)), `${s.id} requiere ${req}`).toBe(true);
        expect(alts).not.toContain(s.id);
      }
    }
    const { ids: todos, faltantes } = resolverDependencias(items.filter(s => s.activo).map(s => s.id), items);
    expect(faltantes).toEqual([]);
    expect(todos.length).toBe(items.filter(s => s.activo).length); // elegirlas todas no agrega nada ajeno
  });
});

describe('tienda: dependencias', () => {
  it('suma sola la base y dice quién la pidió', () => {
    const r = resolverDependencias(['sec'], catalogo);
    expect(r.ids).toEqual(['sec', 'base']);
    expect(r.agregados).toEqual({ base: 'sec' });
  });

  it('"a|b": si ya hay una de las dos no agrega nada; si no, agrega la primera', () => {
    expect(resolverDependencias(['crm', 'db2'], catalogo).ids).toEqual(['crm', 'db2', 'base']);
    expect(resolverDependencias(['crm'], catalogo).ids).toEqual(['crm', 'base', 'db1']);
  });

  it('un requisito que no existe o está desactivado se informa como faltante', () => {
    expect(resolverDependencias(['huerfano'], catalogo).faltantes).toEqual(['no_existe']);
    const sinDb = catalogo.map(s => (s.id.startsWith('db') ? { ...s, activo: false } : s));
    expect(resolverDependencias(['crm'], sinDb).faltantes).toEqual(['db1|db2']);
  });

  it('no se cuelga con dependencias circulares', () => {
    const ciclo = [pieza('a', 1, { requiere: ['b'] }), pieza('b', 1, { requiere: ['a'] })];
    expect(resolverDependencias(['a'], ciclo).ids.sort()).toEqual(['a', 'b']);
  });
});

describe('tienda: cotizar', () => {
  it('seña: la mitad; total: 10% off; las dependencias se cobran una sola vez', () => {
    const sena = cotizar({ ids: ['sec', 'sec'], modo: 'sena', catalogo, cotizacion: 1000 });
    expect(sena).toMatchObject({ subtotalUSD: 200, totalUSD: 200, aPagarUSD: 100, saldoUSD: 100, aPagarARS: 100000 });
    expect(sena.items.map(i => i.id)).toEqual(['sec', 'base']);
    expect(sena.items[1].agregadoPor).toBe('sec');
    expect(cotizar({ ids: ['sec'], modo: 'sena', catalogo, cotizacion: 1000, senaPct: 0.6 }).aPagarUSD).toBe(120);
    const total = cotizar({ ids: ['sec'], modo: 'total', catalogo, cotizacion: 1000 });
    expect(total).toMatchObject({ descuentoUSD: 20, totalUSD: 180, aPagarUSD: 180, saldoUSD: 0, aPagarARS: 180000 });
  });

  it('si ya eligió la base no se cobra dos veces', () => {
    expect(cotizar({ ids: ['base', 'sec'], modo: 'presupuesto', catalogo }).subtotalUSD).toBe(200);
  });

  it('páginas extra: precio por cantidad, mínimo 1 y tope 20', () => {
    const q = cotizar({ ids: ['pag'], cantidades: { pag: 3 }, modo: 'presupuesto', catalogo });
    expect(q.subtotalUSD).toBe(450); // 150 base + 3 × 100
    expect(q.items[0]).toMatchObject({ id: 'pag', label: 'PAG ×3', priceUSD: 300, cantidad: 3 });
    expect(cotizar({ ids: ['pag'], cantidades: { pag: 0 }, modo: 'presupuesto', catalogo }).subtotalUSD).toBe(250);
    expect(cotizar({ ids: ['pag'], cantidades: { pag: 999 }, modo: 'presupuesto', catalogo }).subtotalUSD).toBe(150 + 20 * 100);
    // una pieza que no es por unidad ignora la cantidad
    expect(cotizar({ ids: ['sec'], cantidades: { sec: 5 }, modo: 'presupuesto', catalogo }).subtotalUSD).toBe(200);
  });

  it('rechaza lo que no cierra', () => {
    expect(() => cotizar({ ids: [], modo: 'sena', catalogo, cotizacion: 1 })).toThrow(/al menos/);
    expect(() => cotizar({ ids: ['inventado'], modo: 'sena', catalogo, cotizacion: 1 })).toThrow(/desconocido/);
    expect(() => cotizar({ ids: ['viejo'], modo: 'sena', catalogo, cotizacion: 1 })).toThrow(/no disponible/);
    expect(() => cotizar({ ids: ['huerfano'], modo: 'sena', catalogo, cotizacion: 1 })).toThrow(/pieza requerida/);
    expect(() => cotizar({ ids: ['sec'], modo: 'gratis', catalogo, cotizacion: 1 })).toThrow(/Modo/);
    expect(() => cotizar({ ids: ['sec'], modo: 'total', catalogo, cotizacion: null })).toThrow(/cotización/);
    expect(cotizar({ ids: ['sec'], modo: 'presupuesto', catalogo }).aPagarUSD).toBe(0);
  });

  it('cliente: nombre y email válidos', () => {
    expect(validarCliente(cliente).cliente.email).toBe('ana@mail.com');
    expect(validarCliente({ nombre: 'Ana', email: 'no' }).error).toMatch(/email/);
    expect(validarCliente({ email: 'a@b.com' }).error).toMatch(/nombre/);
  });
});

describe('tienda: dólar', () => {
  it('usa la segunda fuente si la primera falla, y tira si fallan las dos', async () => {
    _resetDolarCache();
    const fetchImpl = vi.fn(async (url) => (url.includes('bluelytics')
      ? { ok: false, status: 500 }
      : { ok: true, json: async () => ({ venta: 1450 }) }));
    expect(await dolarOficialVenta({ fetchImpl, now: 1 })).toEqual({ cotizacion: 1450, fuente: 'dolarapi' });
    _resetDolarCache();
    await expect(dolarOficialVenta({ fetchImpl: async () => ({ ok: false, status: 503 }), now: 2 })).rejects.toThrow(/cotización/);
  });
});

const docsCatalogo = {
  'tienda_catalogo/base_sitio': { categoria: 'Base', tipo: 'base', label: 'Base del sitio', priceUSD: 150, requiere: [], orden: 0 },
  'tienda_catalogo/sec_portada': { categoria: 'Secciones', tipo: 'seccion', label: 'Portada', priceUSD: 50, requiere: ['base_sitio'], orden: 1 },
};
const user = { uid: 'u1', email: 'ana@mail.com' };

describe('tienda: catálogo en Firestore', () => {
  it('lee tienda_catalogo; si está vacía cae al del código con los precios de service_benefits', async () => {
    const { db } = createFakeDb(docsCatalogo);
    const items = await cargarCatalogo(db);
    expect(items.map(s => s.id).sort()).toEqual(['base_sitio', 'sec_portada']);
    const vacio = createFakeDb({ 'service_benefits/payments_mp': { priceUSD: 500 } }).db;
    const delCodigo = await cargarCatalogo(vacio);
    expect(delCodigo.find(s => s.id === 'payments_mp').priceUSD).toBe(500);
  });

  it('sembrar carga el catálogo del código solo si la colección está vacía', async () => {
    const { db, docs } = createFakeDb({ 'service_benefits/claude_mcp': { priceUSD: 1000 } });
    const r = await sembrarCatalogo(db);
    expect(r.yaExistia).toBe(false);
    expect(r.sembrados).toBeGreaterThan(40);
    expect(docs['tienda_catalogo/claude_mcp'].priceUSD).toBe(1000);
    expect(docs['tienda_catalogo/landing'].activo).toBe(false);
    expect(docs['tienda_catalogo/base_sitio'].id).toBeUndefined();
    expect(await sembrarCatalogo(db)).toEqual({ sembrados: 0, yaExistia: true });
  });

  it('valida lo que guarda el admin', () => {
    const ok = { id: 'sec_nueva', label: 'Nueva', categoria: 'Secciones', tipo: 'seccion', priceUSD: 40, requiere: 'base_sitio, db_a|db_b' };
    expect(validarPieza(ok).doc.requiere).toEqual(['base_sitio', 'db_a|db_b']);
    expect(validarPieza({ ...ok, id: 'Mal Id' }).error).toMatch(/id/);
    expect(validarPieza({ ...ok, priceUSD: -1 }).error).toMatch(/Precio/);
    expect(validarPieza({ ...ok, tipo: 'otro' }).error).toMatch(/Tipo/);
    expect(validarPieza({ ...ok, requiere: 'sec_nueva' }).error).toMatch(/sí misma/);
    expect(validarPieza({ ...ok, requiere: 'x y' }).error).toMatch(/Dependencias/);
  });

  it('actualizar campos sueltos conserva el resto', async () => {
    const { db, docs } = createFakeDb(docsCatalogo);
    expect(await actualizarCampos(db, 'sec_portada', { priceUSD: 60 })).toMatchObject({ ok: true });
    expect(docs['tienda_catalogo/sec_portada']).toMatchObject({ priceUSD: 60, label: 'Portada', requiere: ['base_sitio'] });
    expect((await actualizarCampos(db, 'nada', { priceUSD: 1 })).error).toMatch(/no existe/);
  });
});

describe('tienda: checkout', () => {
  it('sin sesión no se cotiza ni se cobra', async () => {
    const { db, writes } = createFakeDb(docsCatalogo);
    const crearLink = vi.fn();
    const r = await checkoutTienda(db, { servicios: ['sec_portada'], modo: 'sena', cliente }, { user: null, dolar: async () => ({ cotizacion: 1000 }), crearLink });
    expect(r).toMatchObject({ status: 401 });
    expect(crearLink).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it('el monto lo calcula el servidor con el catálogo de Firestore (dependencias incluidas) y crea el link por la seña', async () => {
    const { db } = createFakeDb(docsCatalogo);
    const crearLink = vi.fn(async () => 'https://mp/pagar');
    const r = await checkoutTienda(db, { servicios: ['sec_portada'], modo: 'sena', cliente, precio: 1 }, {
      user, dolar: async () => ({ cotizacion: 1000 }), crearLink,
    });
    expect(r).toMatchObject({ status: 200, init_point: 'https://mp/pagar' });
    const [p, monto, opts] = crearLink.mock.calls[0];
    expect(monto).toBe(100000); // (150 base + 50 portada) × 50% × 1000
    expect(opts.titulo).toMatch(/^Seña 50% - 2 servicios - Ana/);
    expect(opts.metadata).toMatchObject({ origen: 'tienda', payment_mode: 'deposit', user_id: 'u1' });
    const doc = (await db.collection('presupuestos').doc(r.id).get()).data();
    expect(doc).toMatchObject({ origen: 'tienda', modoPago: 'sena', budgetUSD: 200, aPagarARS: 100000, paymentLink: 'https://mp/pagar', status: 'pending', userId: 'u1' });
    expect(doc.servicioIds).toEqual(['sec_portada', 'base_sitio']);
    expect(p.id).toBe(r.id);
  });

  it('la seña sigue el plan de pago del admin', async () => {
    const { db } = createFakeDb({ ...docsCatalogo, 'site_config/payment_plan': { milestones: [{ label: 'Seña', pct: 30 }, { label: 'Final', pct: 70 }] } });
    const crearLink = vi.fn(async () => 'https://mp/pagar');
    await checkoutTienda(db, { servicios: ['base_sitio'], modo: 'sena', cliente }, { user, dolar: async () => ({ cotizacion: 1000 }), crearLink });
    expect(crearLink.mock.calls[0][1]).toBe(45000);
  });

  it('pedir presupuesto no cobra ni pide cotización; sin dólar no se cobra', async () => {
    const { db } = createFakeDb(docsCatalogo);
    const crearLink = vi.fn();
    const dolar = vi.fn(async () => { throw new Error('No se pudo obtener la cotización del dólar'); });
    const r = await checkoutTienda(db, { servicios: ['base_sitio'], modo: 'presupuesto', cliente }, { user, dolar, crearLink });
    expect(r.status).toBe(200);
    expect(r.init_point).toBeUndefined();
    expect(dolar).not.toHaveBeenCalled();
    const sinDolar = await checkoutTienda(db, { servicios: ['base_sitio'], modo: 'total', cliente }, { user, dolar, crearLink });
    expect(sinDolar.status).toBe(503);
    expect(crearLink).not.toHaveBeenCalled();
  });
});
