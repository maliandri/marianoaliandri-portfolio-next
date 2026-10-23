import { describe, it, expect } from 'vitest';
import { localidadKey, ciudadDe, oportunidad, rankAnalyzed } from './rubroDemand.js';

describe('rubroDemand', () => {
  it('localidadKey normaliza acentos y espacios', () => {
    expect(localidadKey('San Martín de los Andes')).toBe('san-martin-de-los-andes');
  });

  it('ciudadDe saca el país', () => {
    expect(ciudadDe('Neuquén, Argentina')).toBe('Neuquén');
    expect(ciudadDe('Plottier')).toBe('Plottier');
  });

  it('rankAnalyzed: el más buscado = 100 y ordena', () => {
    const r = rankAnalyzed([{ id: 'a', raw: 500 }, { id: 'b', raw: 1000 }]);
    expect(r.map(x => [x.id, x.interes])).toEqual([['b', 100], ['a', 50]]);
  });

  it('oportunidad: sin web > SEO malo > SEO bueno; sin demanda = -1', () => {
    const d = { demanda: { interes: 80 } };
    const sinWeb = oportunidad({ ...d });
    const malo = oportunidad({ ...d, siteUrl: 'x', seoScore: 30 });
    const bueno = oportunidad({ ...d, siteUrl: 'x', seoScore: 90 });
    expect(sinWeb).toBeGreaterThan(malo);
    expect(malo).toBeGreaterThan(bueno);
    expect(oportunidad({ siteUrl: 'x' })).toBe(-1);
  });
});
