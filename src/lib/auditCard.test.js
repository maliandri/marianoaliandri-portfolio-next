import { describe, it, expect } from 'vitest';
import { distribucion, resumirLugar, renderAuditCard } from './auditCard.js';

const filas = (...scores) => scores.map((seoScore, i) => ({ id: String(i), seoScore }));

describe('auditCard', () => {
  it('distribucion usa los cortes del informe (<40, 40–69, 70+) y los porcentajes', () => {
    const d = distribucion(filas(10, 39, 40, 69, 70, 100, 55, 20));
    expect(d.map(r => r.n)).toEqual([3, 3, 2]);
    expect(d.map(r => r.pct)).toEqual([38, 38, 25]);
  });

  it('resumirLugar no corta palabras: si no entra agrega "+N más"', () => {
    expect(resumirLugar('Comarca petrolera')).toBe('Comarca petrolera');
    const largo = resumirLugar('Comodoro Rivadavia · Rada Tilly · Caleta Olivia · Cutral Có · Plaza Huincul · Añelo');
    expect(largo).toMatch(/ · \+\d+ más$/);
    expect(largo.length).toBeLessThanOrEqual(64);
    expect(largo.startsWith('Comodoro Rivadavia')).toBe(true);
  });

  it('la tarjeta lleva el radio en la zona', async () => {
    const { auditCardTree } = await import('./auditCard.js');
    const json = JSON.stringify(auditCardTree({ rubro: 'Ropa', ciudad: 'Neuquén', radioKm: 30, stats: { total: 3 }, results: [] }));
    expect(json).toContain('Neuquén · radio 30 km');
  });

  it('distribucion sin sitios no divide por cero', () => {
    expect(distribucion([]).map(r => [r.n, r.pct])).toEqual([[0, 0], [0, 0], [0, 0]]);
  });

  it('renderiza un PNG de 1080x1350 (4:5) para cualquier cantidad de sitios', async () => {
    for (const n of [0, 3, 30]) {
      const results = filas(...Array.from({ length: n }, (_, i) => (i * 7) % 100));
      const png = await renderAuditCard({
        rubro: 'Estudios de arquitectura', ciudad: 'Gran Mendoza',
        stats: { total: n, avgSeoScore: n ? 50 : null, lowSeoCount: 1 }, results,
      });
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(1080);
      expect(png.readUInt32BE(20)).toBe(1350);
    }
  });

  it('aguanta nombres largos y con emojis sin romper', async () => {
    const png = await renderAuditCard({
      rubro: 'Construcción en seco y viviendas industrializadas 🏗️ de la región', ciudad: 'Comodoro Rivadavia · Rada Tilly · Caleta Olivia · Cutral Có · Plaza Huincul',
      stats: { total: 5, avgSeoScore: 39, lowSeoCount: 4 }, results: filas(10, 20, 30, 80, 50),
    });
    expect(png.readUInt32BE(20)).toBe(1350);
  });
});
