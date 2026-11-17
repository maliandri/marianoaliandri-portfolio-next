import { describe, it, expect, vi } from 'vitest';
import { normalizarItem } from '@/lib/tienda';
import { serviciosPublicos, cotizacionParaChat, crearHerramientasChat, pidioLogin, linkTienda } from './chatTools';

const catalogo = [
  normalizarItem('base', { categoria: 'Base', tipo: 'base', label: 'Base del sitio', desc: 'Estructura inicial', priceUSD: 150 }, 0),
  normalizarItem('pagos', { categoria: 'Módulos', tipo: 'modulo', label: 'Cobros con MercadoPago', desc: 'Pagos online', priceUSD: 200 }, 1),
  normalizarItem('paginas', { categoria: 'Secciones', tipo: 'seccion', label: 'Página extra', desc: 'Una página más', priceUSD: 50, porUnidad: true }, 2),
  normalizarItem('viejo', { categoria: 'Módulos', tipo: 'modulo', label: 'Paquete viejo', desc: 'ya no se vende', priceUSD: 999, activo: false }, 3),
];
const deps = { cargar: async () => catalogo, cargarSena: async () => 0.5, dolar: async () => ({ cotizacion: 1000 }) };
const run = (t, args) => t.execute(args, { toolCallId: 'x', messages: [] });

describe('serviciosPublicos', () => {
  it('no incluye precios ni servicios inactivos', () => {
    const out = JSON.stringify(serviciosPublicos(catalogo));
    expect(out).not.toMatch(/priceUSD|150|200|999/);
    expect(out).not.toContain('viejo');
    expect(out).toContain('Cobros con MercadoPago');
  });
  it('filtra por texto', () => {
    const r = serviciosPublicos(catalogo, { texto: 'pagos' });
    expect(r.flatMap(c => c.servicios).map(s => s.id)).toEqual(['pagos']);
  });
});

describe('cotizacionParaChat', () => {
  it('calcula pago total con 10% off, seña y pesos', () => {
    const q = cotizacionParaChat({ ids: ['base', 'pagos'], catalogo, cotizacion: 1000, senaPct: 0.5 });
    expect(q.subtotalUSD).toBe(350);
    expect(q.pagoTotal).toMatchObject({ totalUSD: 315, totalARS: 315000 });
    expect(q.sena).toMatchObject({ porcentaje: 50, aPagarUSD: 175, aPagarARS: 175000 });
    expect(q.linkTienda).toContain('/tienda/?servicios=base,pagos');
  });
  it('respeta la cantidad de servicios por unidad', () => {
    const q = cotizacionParaChat({ ids: ['paginas'], cantidades: { paginas: 3 }, catalogo, cotizacion: 1000, senaPct: 0.5 });
    expect(q.subtotalUSD).toBe(150);
  });
  it('tira con un servicio inexistente o inactivo', () => {
    expect(() => cotizacionParaChat({ ids: ['nada'], catalogo, cotizacion: 1, senaPct: 0.5 })).toThrow(/desconocido/);
    expect(() => cotizacionParaChat({ ids: ['viejo'], catalogo, cotizacion: 1, senaPct: 0.5 })).toThrow(/no disponible/);
  });
});

describe('herramienta cotizar', () => {
  it('SIN sesión no devuelve ningún precio y pide login', async () => {
    const t = crearHerramientasChat({ db: {}, user: null, ...deps }).cotizar;
    const r = await run(t, { servicios: ['base', 'pagos'] });
    expect(r.requiereLogin).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/\b(150|200|315|350|usd|ARS)\b/i);
  });
  it('sin sesión ni siquiera lee el catálogo con precios', async () => {
    const cargar = vi.fn();
    await run(crearHerramientasChat({ db: {}, user: null, ...deps, cargar }).cotizar, { servicios: ['base'] });
    expect(cargar).not.toHaveBeenCalled();
  });
  it('CON sesión cotiza', async () => {
    const t = crearHerramientasChat({ db: {}, user: { uid: 'u1' }, ...deps }).cotizar;
    const r = await run(t, { servicios: ['base', 'pagos'] });
    expect(r.requiereLogin).toBeUndefined();
    expect(r.pagoTotal.totalUSD).toBe(315);
  });
  it('si no hay dólar igual cotiza en USD', async () => {
    const t = crearHerramientasChat({ db: {}, user: { uid: 'u1' }, ...deps, dolar: async () => { throw new Error('caído'); } }).cotizar;
    const r = await run(t, { servicios: ['base'] });
    expect(r.pagoTotal.totalUSD).toBe(135);
    expect(r.pagoTotal.totalARS).toBeUndefined();
  });
  it('un servicio que no existe vuelve como error legible, no como excepción', async () => {
    const t = crearHerramientasChat({ db: {}, user: { uid: 'u1' }, ...deps }).cotizar;
    const r = await run(t, { servicios: ['inventado'] });
    expect(r.error).toMatch(/desconocido/);
  });
});

describe('herramienta ver_servicios', () => {
  it('no filtra precios aunque haya sesión', async () => {
    const t = crearHerramientasChat({ db: {}, user: { uid: 'u1' }, ...deps }).ver_servicios;
    const r = await run(t, {});
    expect(JSON.stringify(r)).not.toMatch(/priceUSD|\b150\b|\b200\b/);
  });
});

describe('pidioLogin / linkTienda', () => {
  it('detecta requiereLogin en los pasos', () => {
    expect(pidioLogin([{ toolResults: [{ output: { requiereLogin: true } }] }])).toBe(true);
    expect(pidioLogin([{ toolResults: [{ output: { items: [] } }] }])).toBe(false);
    expect(pidioLogin([])).toBe(false);
  });
  it('arma el link con ids escapados', () => {
    expect(linkTienda(['a', 'b c'])).toBe('https://marianoaliandri.com.ar/tienda/?servicios=a,b%20c');
  });
});
