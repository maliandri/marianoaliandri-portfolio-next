import { describe, it, expect } from 'vitest';
import { demandaDe, labelToIdFor, tipoParams } from './leadDemand';
import { RUBROS } from '@/data/rubros';

const rubro = RUBROS[0];

describe('leadDemand', () => {
  it('devuelve la demanda ya guardada en el lead', () => {
    const d = { interes: 50 };
    expect(demandaDe({ demanda: d, ciudad: 'X', tipo: 'Y' }, {}, {})).toBe(d);
  });

  it('busca los rubros de Maps por id', () => {
    const l2id = labelToIdFor([rubro.id], 'es');
    const label = tipoParams([rubro.id], 'es')[0].label;
    const demanda = { Neuquén: { porRubro: { [rubro.id]: { interes: 80 } } } };
    expect(demandaDe({ ciudad: 'Neuquén', tipo: label }, demanda, l2id)).toEqual({ interes: 80 });
  });

  it('busca los términos libres por el texto', () => {
    const demanda = { Neuquén: { porTermino: { Gomería: { interes: 30 } } } };
    expect(demandaDe({ ciudad: 'Neuquén', tipo: 'Gomería' }, demanda, {})).toEqual({ interes: 30 });
  });

  it('sin demanda para la ciudad devuelve null', () => {
    expect(demandaDe({ ciudad: 'Otra', tipo: 'Gomería' }, {}, {})).toBeNull();
  });
});
