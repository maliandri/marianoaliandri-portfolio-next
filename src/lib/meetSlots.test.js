import { describe, it, expect } from 'vitest';
import { turnosLibres, turnoValido, MEET_DEFAULT } from './meetSlots';

// now = miércoles 25/11/2026 10:00 ART (13:00 UTC). Argentina = UTC−3 todo el año.
const now = Date.parse('2026-11-25T13:00:00Z');
const config = MEET_DEFAULT;

describe('turnosLibres', () => {
  const t = turnosLibres({ config, ocupados: [], now });

  it('arranca a las 24 h exactas: jueves 10:00 ART', () => {
    expect(t.slice(0, 4)).toEqual(['2026-11-26T13:00:00.000Z', '2026-11-26T13:30:00.000Z', '2026-11-26T14:00:00.000Z', '2026-11-26T14:30:00.000Z']);
  });
  it('solo lunes a viernes de 09:00 a 11:30 ART', () => {
    for (const iso of t) {
      const d = new Date(Date.parse(iso) - 3 * 3600000); // hora argentina
      expect([1, 2, 3, 4, 5]).toContain(d.getUTCDay());
      const min = d.getUTCHours() * 60 + d.getUTCMinutes();
      expect(min).toBeGreaterThanOrEqual(9 * 60);
      expect(min).toBeLessThanOrEqual(11 * 60 + 30);
    }
    expect(t).toContain('2026-11-27T12:00:00.000Z'); // viernes 09:00 ART
    expect(t.some(x => x.startsWith('2026-11-28') || x.startsWith('2026-11-29'))).toBe(false);
  });
  it('nada más allá de 14 días', () => {
    expect(Math.max(...t.map(Date.parse))).toBeLessThanOrEqual(now + 14 * 86400000);
  });
  it('saca los turnos que se pisan con algo ocupado', () => {
    const r = turnosLibres({ config, ocupados: [{ inicio: '2026-11-26T13:15:00Z', fin: '2026-11-26T13:45:00Z' }], now });
    expect(r).not.toContain('2026-11-26T13:00:00.000Z');
    expect(r).not.toContain('2026-11-26T13:30:00.000Z');
    expect(r).toContain('2026-11-26T14:00:00.000Z');
  });
});

describe('turnoValido', () => {
  it('un sábado no es válido; un turno de la lista sí', () => {
    expect(turnoValido('2026-11-28T13:00:00Z', { config, ocupados: [], now })).toBe(false);
    expect(turnoValido('2026-11-26T13:00:00Z', { config, ocupados: [], now })).toBe(true);
    expect(turnoValido('basura', { config, ocupados: [], now })).toBe(false);
  });
});
