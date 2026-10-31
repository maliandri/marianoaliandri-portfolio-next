import { describe, it, expect } from 'vitest';
import { RUBROS_SEMILLA } from './auditoriaAuto';
import { busquedasDe } from '@/lib/autoAudit';

// Tipos que Places API (New) rechaza en searchNearby ("Unsupported types"), confirmados
// contra la API real. general_contractor existía en la API vieja pero no en la nueva.
const UNSUPPORTED_PLACE_TYPES = ['general_contractor'];

describe('RUBROS_SEMILLA', () => {
  it('no usa tipos de lugar que Places API (New) no acepta', () => {
    const bad = RUBROS_SEMILLA.filter(r => busquedasDe(r).tipos.some(t => UNSUPPORTED_PLACE_TYPES.includes(t)));
    expect(bad.map(r => r.label)).toEqual([]);
  });

  it('las constructoras siguen entrando (por texto)', () => {
    expect(RUBROS_SEMILLA.some(r => busquedasDe(r).terminos.includes('constructor'))).toBe(true);
  });

  it('cada grupo tiene al menos una búsqueda y nombre único', () => {
    for (const r of RUBROS_SEMILLA) {
      const { terminos, tipos } = busquedasDe(r);
      expect(terminos.length + tipos.length, r.label).toBeGreaterThan(0);
    }
    expect(new Set(RUBROS_SEMILLA.map(r => r.label)).size).toBe(RUBROS_SEMILLA.length);
  });
});
