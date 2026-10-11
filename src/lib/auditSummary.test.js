import { describe, it, expect } from 'vitest';
import { scoreDistribution, shortTitle, auditCities, mapPlate, formatCoord } from './auditSummary';

describe('scoreDistribution', () => {
  it('cuenta por rango y los porcentajes suman 100', () => {
    const d = scoreDistribution([100, 100, 85, 60, 15, 0, null].map(seoScore => ({ seoScore })));
    expect(d.total).toBe(6);
    expect(d.buckets.map(b => b.n)).toEqual([2, 1, 1, 2]);
    expect(d.buckets.reduce((a, b) => a + b.pct, 0)).toBe(100);
  });

  it('sin scores devuelve ceros', () => {
    const d = scoreDistribution([]);
    expect(d.total).toBe(0);
    expect(d.buckets.every(b => b.n === 0 && b.pct === 0)).toBe(true);
  });

  it('respeta los bordes 80 y 50', () => {
    const d = scoreDistribution([{ seoScore: 80 }, { seoScore: 79 }, { seoScore: 50 }, { seoScore: 49 }]);
    expect(d.buckets.map(b => b.n)).toEqual([0, 1, 2, 1]);
  });
});

describe('shortTitle', () => {
  const cases = [
    ['Auditoría SEO de 5 sitios de Contabilidad en Villa Mercedes (10 de octubre de 2026)', ['Villa Mercedes'], 'Contabilidad'],
    ['Auditoría SEO de páginas web de Empresa Constructora (09 de octubre de 2026)', ['Neuquén'], 'Empresa Constructora'],
    ['Auditoría SEO — Consecionarios de Autos, Neuquén (15 de agosto de 2026)', ['Neuquén'], 'Consecionarios de Autos'],
    ['Auditoría SEO — Farmacias en  Neuquén (15 de agosto de 2026)', ['Neuquén'], 'Farmacias'],
    ['Auditoría SEO — Neuquén, Fabricas de Aberturas (29 de julio de 2026)', ['Neuquén', 'Centenario'], 'Fabricas de Aberturas'],
    ['Auditoría SEO — Neuquén Muebles a Medida.', ['Neuquén'], 'Muebles a Medida'],
    ['Auditoría SEO — Neuquén A Constructoras y Estudios de Arquitectura.', ['Neuquén'], 'Constructoras y Estudios de Arquitectura'],
    ['Auditoría SEO A Negocios de construccion sustentable — Neuquén (05 de julio de 2026)', ['Neuquén'], 'Negocios de construccion sustentable'],
    ['Auditoría SEO de páginas web de inmobiliaria (14 de septiembre de 2026)', ['Neuquén'], 'Inmobiliaria'],
  ];
  it.each(cases)('%s', (title, cities, expected) => {
    expect(shortTitle(title, cities)).toBe(expected);
  });

  it('usa el término de búsqueda si el título queda vacío', () => {
    expect(shortTitle('Auditoría SEO', [], [{ tipo: 'CONSTRUCCION MODULAR' }])).toBe('Construccion modular');
  });
});

describe('auditCities', () => {
  it('cae a las ciudades de los resultados si la config no tiene', () => {
    const r = [{ ciudad: 'Plottier' }, { ciudad: 'Neuquén' }, { ciudad: 'Neuquén' }];
    expect(auditCities({ ciudades: [] }, r)).toEqual(['Neuquén', 'Plottier']);
  });
});

describe('mapPlate', () => {
  it('ubica los puntos dentro del recuadro y arma tiles de OSM', () => {
    const results = [
      { lat: -38.95, lon: -68.06, seoScore: 100 },
      { lat: -38.96, lon: -68.10, seoScore: 30 },
      { lat: -38.93, lon: -68.02, seoScore: 85 },
    ];
    const p = mapPlate(results, 10);
    expect(p.tiles.length).toBeGreaterThan(0);
    expect(p.tiles[0].src).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    for (const pt of p.points) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(100);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(100);
    }
    expect(p.points.map(x => x.bucket)).toEqual(['100', '0', '80']);
  });

  it('descarta un punto muy lejano y devuelve null sin coordenadas', () => {
    const results = [
      { lat: -38.95, lon: -68.06 }, { lat: -38.96, lon: -68.07 }, { lat: -38.94, lon: -68.05 },
      { lat: -34.6, lon: -58.4 },
    ];
    expect(mapPlate(results, 10).hidden).toBe(1);
    expect(mapPlate([{ nombre: 'x' }], 10)).toBeNull();
  });
});

describe('formatCoord', () => {
  it('formatea grados y minutos con hemisferio', () => {
    expect(formatCoord(-38.951, -68.059)).toBe('38°57′S 68°04′O');
  });
});
