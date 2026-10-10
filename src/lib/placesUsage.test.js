import { describe, it, expect } from 'vitest';
import { buildUsageReport } from './placesUsage';

const LIMITS = {
  details:      { free: 1000, usdPer1000: 20 },
  searchText:   { free: 1000, usdPer1000: 35 },
  searchNearby: { free: 1000, usdPer1000: 35 },
};

const ROWS = [
  { id: '2026-10-09', getPlaceRequests: 59, searchTextRequests: 6 },
  { id: '2026-10-03', getPlaceRequests: 19, searchTextRequests: 2 },
  { id: '2026-09-29', getPlaceRequests: 117, searchTextRequests: 6 }, // otro mes
  { id: '2026-10-05', searchNearbyRequests: 3 },
];

describe('buildUsageReport', () => {
  it('filtra el mes, ordena por fecha y acumula comercios', () => {
    const r = buildUsageReport(ROWS, { month: '2026-10', today: '2026-10-10', limits: LIMITS });
    expect(r.days.map(d => d.date)).toEqual(['2026-10-03', '2026-10-05', '2026-10-09']);
    expect(r.days.map(d => d.comercios)).toEqual([19, 0, 59]);
    expect(r.days.map(d => d.acumulado)).toEqual([19, 19, 78]);
    expect(r.days.map(d => d.restantes)).toEqual([981, 981, 922]);
    expect(r.days[1].busquedas).toBe(3);
  });

  it('totales del mes por tipo de llamada', () => {
    const r = buildUsageReport(ROWS, { month: '2026-10', today: '2026-10-10', limits: LIMITS });
    expect(r.totals).toEqual({ details: 78, searchText: 8, searchNearby: 3 });
    expect(r.restantes).toBe(922);
  });

  it('proyecta el mes en curso al ritmo de los días transcurridos', () => {
    // 78 en 10 días → 7,8/día × 31 días = 241,8 → 242
    const r = buildUsageReport(ROWS, { month: '2026-10', today: '2026-10-10', limits: LIMITS });
    expect(r.proyeccion.details).toBe(242);
    expect(r.costoEstimadoUSD).toBe(0);
  });

  it('en un mes pasado la proyección es el total real', () => {
    const r = buildUsageReport(ROWS, { month: '2026-09', today: '2026-10-10', limits: LIMITS });
    expect(r.totals.details).toBe(117);
    expect(r.proyeccion.details).toBe(117);
  });

  it('estima el costo de lo que pasa del cupo gratis', () => {
    const rows = [{ id: '2026-10-01', getPlaceRequests: 1500, searchTextRequests: 1200 }];
    const r = buildUsageReport(rows, { month: '2026-10', today: '2026-10-31', limits: LIMITS });
    expect(r.restantes).toBe(0);
    expect(r.excedente).toEqual({ details: 500, searchText: 200, searchNearby: 0 });
    // 500/1000×20 + 200/1000×35 = 10 + 7
    expect(r.costoEstimadoUSD).toBe(17);
  });

  it('el costo usa la proyección en el mes en curso', () => {
    const rows = [{ id: '2026-10-01', getPlaceRequests: 600 }];
    // 600 en 10 días → 1860 proyectados → 860 de excedente → 17,2
    const r = buildUsageReport(rows, { month: '2026-10', today: '2026-10-10', limits: LIMITS });
    expect(r.proyeccion.details).toBe(1860);
    expect(r.costoEstimadoUSD).toBe(17.2);
  });

  it('mes sin datos', () => {
    const r = buildUsageReport([], { month: '2026-11', today: '2026-10-10', limits: LIMITS });
    expect(r.days).toEqual([]);
    expect(r.totals).toEqual({ details: 0, searchText: 0, searchNearby: 0 });
    expect(r.restantes).toBe(1000);
    expect(r.costoEstimadoUSD).toBe(0);
  });
});
