import { describe, it, expect } from 'vitest';
import { RUBROS_SEMILLA } from './auditoriaAuto';

// Tipos que Places API (New) rechaza en searchNearby ("Unsupported types"), confirmados
// contra la API real. general_contractor existía en la API vieja pero no en la nueva.
const UNSUPPORTED_PLACE_TYPES = ['general_contractor'];

describe('RUBROS_SEMILLA', () => {
  it('no usa tipos de lugar que Places API (New) no acepta', () => {
    const bad = RUBROS_SEMILLA.filter(r => r.kind === 'type' && UNSUPPORTED_PLACE_TYPES.includes(r.value));
    expect(bad.map(r => r.label)).toEqual([]);
  });

  it('sigue teniendo el rubro Constructor', () => {
    expect(RUBROS_SEMILLA.some(r => r.label === 'Constructor')).toBe(true);
  });
});
