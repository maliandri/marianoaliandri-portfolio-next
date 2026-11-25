import { describe, it, expect } from 'vitest';
import { contextoAsistente, herramientasAsistente, sinMontos } from './tiendaAsistente';
import { explicacionAlMarcar } from '@/lib/tiendaExplicacion';
import { normalizarItem } from '@/lib/tienda';

const catalogo = [
  normalizarItem('catalogo_productos', { label: 'Catálogo de productos', priceUSD: 400 }),
  normalizarItem('carrito', { label: 'Carrito de compras', priceUSD: 250, requiere: ['catalogo_productos'] }),
  normalizarItem('viejo', { label: 'Viejo', priceUSD: 999, activo: false }),
];
const run = (t, args) => t.execute(args, { toolCallId: 'x', messages: [] });

describe('contextoAsistente', () => {
  const ctx = contextoAsistente({ catalogo, contextoGeneral: 'Sos el asistente.', marcados: ['carrito'] });
  it('no lleva precios', () => {
    expect(ctx).not.toMatch(/priceUSD|US\$\s?\d|\$\s?\d|\b(250|400|999)\b/);
  });
  it('incluye las fichas, lo marcado y la regla de precios', () => {
    expect(ctx).toContain(catalogo[1].ficha.paraQue);
    expect(ctx).toMatch(/MARCADO AHORA[\s\S]*carrito/);
    expect(ctx).toMatch(/Nunca des precios/);
    expect(ctx).not.toContain('Viejo');
  });
});

describe('sinMontos', () => {
  it('saca los montos de plata', () => {
    const r = sinMontos('Sale US$ 500 o $ 750.000 más o menos, o 300 dólares, o 1.200 USD');
    expect(r).not.toMatch(/(US\$|\$)\s?\d|\d[\d.,]*\s?(dólares|USD|pesos)/i);
    expect(r).toMatch(/lo charlamos en la reunión/);
  });
  it('no toca números que no son plata', () => {
    expect(sinMontos('Tarda 2 semanas y entran 30 productos')).toBe('Tarda 2 semanas y entran 30 productos');
  });
});

describe('herramientasAsistente', () => {
  const h = herramientasAsistente({ catalogo });
  it('sumar y sacar devuelven acciones; un id inexistente da error', async () => {
    expect(await run(h.sumar_servicio, { id: 'carrito' })).toEqual({ accion: 'sumar', id: 'carrito' });
    expect(await run(h.sacar_servicio, { id: 'carrito' })).toEqual({ accion: 'sacar', id: 'carrito' });
    expect((await run(h.sumar_servicio, { id: 'inventado' })).error).toBeTruthy();
    expect((await run(h.sumar_servicio, { id: 'viejo' })).error).toBeTruthy();
  });
  it('ver_ficha no trae precio', async () => {
    const r = await run(h.ver_ficha, { id: 'carrito' });
    expect(r.nombre).toBe('Carrito de compras');
    expect(JSON.stringify(r)).not.toMatch(/price|250/);
  });
});

describe('explicacionAlMarcar', () => {
  it('explica para qué sirve y por qué se sumó algo', () => {
    const t = explicacionAlMarcar(catalogo[0], { agregadoPor: 'Carrito de compras' });
    expect(t).toContain(catalogo[0].ficha.paraQue);
    expect(t).toMatch(/Lo sumé porque lo necesita Carrito de compras/);
  });
  it('sin ficha usa el beneficio o la descripción', () => {
    expect(explicacionAlMarcar({ label: 'X', benefit: 'Sirve para algo', ficha: null })).toMatch(/Sirve para algo/);
  });
});
