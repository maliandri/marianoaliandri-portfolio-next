import { describe, it, expect } from 'vitest';
import { normalizarItem } from '@/lib/tienda';
import { serviciosPublicos, crearHerramientasChat, linkTienda } from './chatTools';

// Venta por consulta (2026-11-25): el chat del sitio NUNCA da precios, ni con sesión. Solo explica servicios.
const catalogo = [
  normalizarItem('base', { categoria: 'Base', tipo: 'base', label: 'Base del sitio', desc: 'Estructura inicial', priceUSD: 150 }, 0),
  normalizarItem('pagos', { categoria: 'Módulos', tipo: 'modulo', label: 'Cobros con MercadoPago', desc: 'Pagos online', priceUSD: 200 }, 1),
  normalizarItem('viejo', { categoria: 'Módulos', tipo: 'modulo', label: 'Paquete viejo', desc: 'ya no se vende', priceUSD: 999, activo: false }, 3),
];
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

describe('crearHerramientasChat', () => {
  it('solo expone ver_servicios (no hay herramienta que cotice)', () => {
    expect(Object.keys(crearHerramientasChat({ db: {}, cargar: async () => catalogo }))).toEqual(['ver_servicios']);
  });
  it('ver_servicios no devuelve precios', async () => {
    const t = crearHerramientasChat({ db: {}, cargar: async () => catalogo }).ver_servicios;
    const r = await run(t, {});
    expect(JSON.stringify(r)).not.toMatch(/priceUSD|"price|\b150\b|\b200\b/);
  });
});

describe('linkTienda', () => {
  it('arma el link con ids escapados', () => {
    expect(linkTienda(['a', 'b c'])).toBe('https://marianoaliandri.com.ar/tienda/?servicios=a,b%20c');
  });
});
