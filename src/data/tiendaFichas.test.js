import { describe, it, expect } from 'vitest';
import { FICHAS, CONTEXTO_GENERAL } from './tiendaFichas';
import { ALL_SERVICES } from './serviceCatalog';
import { normalizarItem, sinPrecios } from '@/lib/tienda';

const activos = ALL_SERVICES.filter(s => s.activo !== false);
const CAMPOS = ['paraQue', 'ejemplo', 'necesitoDeVos', 'tiempo'];

describe('FICHAS', () => {
  it('cada servicio activo tiene su ficha completa', () => {
    for (const s of activos) {
      const f = FICHAS[s.id];
      expect(f, s.id).toBeTruthy();
      for (const c of CAMPOS) expect(String(f[c] || '').trim().length, `${s.id}.${c}`).toBeGreaterThan(c === 'tiempo' ? 5 : 10);
      expect(Array.isArray(f.faq) && f.faq.length, `${s.id}.faq`).toBeGreaterThanOrEqual(2);
      for (const q of f.faq) expect(q.q && q.a, `${s.id}.faq`).toBeTruthy();
    }
  });

  it('no hay montos de plata en las fichas ni en el contexto', () => {
    const txt = JSON.stringify(FICHAS) + CONTEXTO_GENERAL;
    expect(txt).not.toMatch(/US\$|\$\s?\d|\bUSD\b|\bARS\b/i);
  });

  it('el contexto general dice que los precios se charlan', () => {
    expect(CONTEXTO_GENERAL).toMatch(/precio/i);
    expect(CONTEXTO_GENERAL).toMatch(/Meet|reuni/i);
  });
});

describe('normalizarItem / sinPrecios con ficha', () => {
  it('conserva la ficha del doc y cae a la del código si falta', () => {
    const conFicha = normalizarItem('x', { priceUSD: 5, ficha: { paraQue: 'algo' } });
    expect(conFicha.ficha).toEqual({ paraQue: 'algo' });
    const sinFicha = normalizarItem('carrito', { priceUSD: 5 });
    expect(sinFicha.ficha).toEqual(FICHAS.carrito);
    expect(normalizarItem('inventado', {}).ficha).toBeNull();
  });
  it('sinPrecios saca el precio pero deja la ficha', () => {
    const [i] = sinPrecios([normalizarItem('a', { priceUSD: 5, ficha: { paraQue: 'x' } })]);
    expect(i).not.toHaveProperty('priceUSD');
    expect(i.ficha).toEqual({ paraQue: 'x' });
  });
});
