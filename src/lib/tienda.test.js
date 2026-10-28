import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from '@/test/fakeDb';
import { catalogoEfectivo, cotizar, validarCliente } from './tienda';
import { dolarOficialVenta, _resetDolarCache } from './dolar';
import { checkoutTienda } from './tiendaCheckout';

const catalogo = catalogoEfectivo({ landing: { priceUSD: 350 } });
const cliente = { nombre: 'Ana', email: 'Ana@Mail.com', telefono: '299 1234567' };

describe('tienda: precios', () => {
  it('el precio editado en el admin pisa el del código', () => {
    const items = catalogo.flatMap(c => c.items);
    expect(items.find(s => s.id === 'landing').priceUSD).toBe(350);
    expect(items.find(s => s.id === 'payments_mp').priceUSD).toBe(250);
  });

  it('seña: la mitad; total: 10% off; en pesos con la cotización', () => {
    const sena = cotizar({ ids: ['landing', 'payments_mp', 'landing'], modo: 'sena', catalogo, cotizacion: 1000 });
    expect(sena).toMatchObject({ subtotalUSD: 600, totalUSD: 600, aPagarUSD: 300, saldoUSD: 300, aPagarARS: 300000 });
    expect(sena.items).toHaveLength(2);
    expect(cotizar({ ids: ['landing'], modo: 'sena', catalogo, cotizacion: 1000, senaPct: 0.6 }).aPagarUSD).toBe(210);
    const total = cotizar({ ids: ['landing', 'payments_mp'], modo: 'total', catalogo, cotizacion: 1000 });
    expect(total).toMatchObject({ descuentoUSD: 60, totalUSD: 540, aPagarUSD: 540, saldoUSD: 0, aPagarARS: 540000 });
  });

  it('rechaza lo que no cierra', () => {
    expect(() => cotizar({ ids: [], modo: 'sena', catalogo, cotizacion: 1 })).toThrow(/al menos/);
    expect(() => cotizar({ ids: ['inventado'], modo: 'sena', catalogo, cotizacion: 1 })).toThrow(/desconocido/);
    expect(() => cotizar({ ids: ['landing'], modo: 'gratis', catalogo, cotizacion: 1 })).toThrow(/Modo/);
    expect(() => cotizar({ ids: ['landing'], modo: 'total', catalogo, cotizacion: null })).toThrow(/cotización/);
    expect(cotizar({ ids: ['landing'], modo: 'presupuesto', catalogo }).aPagarUSD).toBe(0);
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

describe('tienda: checkout', () => {
  it('el monto lo calcula el servidor, guarda el pedido y crea el link por la seña', async () => {
    const { db } = createFakeDb({ 'service_benefits/landing': { priceUSD: 350 } });
    const crearLink = vi.fn(async () => 'https://mp/pagar');
    const r = await checkoutTienda(db, { servicios: ['landing'], modo: 'sena', cliente, precio: 1 }, {
      user: { uid: 'u1', email: 'ana@mail.com' }, dolar: async () => ({ cotizacion: 1000 }), crearLink,
    });
    expect(r).toMatchObject({ status: 200, init_point: 'https://mp/pagar' });
    const [p, monto, opts] = crearLink.mock.calls[0];
    expect(monto).toBe(175000);
    expect(opts.titulo).toMatch(/^Seña 50% - Landing Page - Ana/);
    const conPlan = createFakeDb({ 'site_config/payment_plan': { milestones: [{ label: 'Seña', pct: 30 }, { label: 'Final', pct: 70 }] } }).db;
    const r2 = await checkoutTienda(conPlan, { servicios: ['landing'], modo: 'sena', cliente }, { dolar: async () => ({ cotizacion: 1000 }), crearLink });
    expect(crearLink.mock.calls[1][1]).toBe(90000);
    expect(r2.status).toBe(200);
    expect(opts.metadata).toMatchObject({ origen: 'tienda', payment_mode: 'deposit', user_id: 'u1' });
    const doc = (await db.collection('presupuestos').doc(r.id).get()).data();
    expect(doc).toMatchObject({ origen: 'tienda', modoPago: 'sena', budgetUSD: 350, aPagarARS: 175000, paymentLink: 'https://mp/pagar', status: 'pending' });
    expect(p.id).toBe(r.id);
  });

  it('pedir presupuesto no cobra ni pide cotización; sin dólar no se cobra', async () => {
    const { db } = createFakeDb({});
    const crearLink = vi.fn();
    const dolar = vi.fn(async () => { throw new Error('No se pudo obtener la cotización del dólar'); });
    const r = await checkoutTienda(db, { servicios: ['landing'], modo: 'presupuesto', cliente }, { dolar, crearLink });
    expect(r.status).toBe(200);
    expect(r.init_point).toBeUndefined();
    expect(dolar).not.toHaveBeenCalled();
    const sinDolar = await checkoutTienda(db, { servicios: ['landing'], modo: 'total', cliente }, { dolar, crearLink });
    expect(sinDolar.status).toBe(503);
    expect(crearLink).not.toHaveBeenCalled();
  });
});
