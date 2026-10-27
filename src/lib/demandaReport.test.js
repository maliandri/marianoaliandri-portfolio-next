import { describe, it, expect } from 'vitest';
import {
  aggregateZone, withCambios, pickZona, buildDemandaCaption, validateDemandaPatch,
  busquedaDe, zonaId, mencionaLocalidad, COOLDOWN_MS,
} from './demandaReport.js';

const a = (id, raw, suggestions = [`${id} 1 x`, `${id} 2 x`]) => ({ id, label: id.toUpperCase(), cat: 'X', count: raw ? 3 : 0, raw, suggestions: raw ? suggestions : [] });

describe('aggregateZone', () => {
  const zona = aggregateZone([
    { localidad: 'Neuquén', busqueda: 'x', analyzed: [a('gomeria', 3000), a('cerrajeria', 2000), a('vacio', 0)] },
    { localidad: 'Plottier', busqueda: 'x', analyzed: [a('gomeria', 500, ['gomeria x plottier']), a('cerrajeria', 1000), a('vacio', 0)] },
  ]);

  it('solo cuenta las frases que nombran la localidad', () => {
    const allen = aggregateZone([{ localidad: 'Allen', analyzed: [
      a('jardin', 1000, ['jardín allende', 'jardín allen centro']),
      a('bar', 1000, ['bar allen', 'bar en allen rio negro']),
    ] }]);
    expect(allen.top.map(r => [r.id, r.interes, r.ejemplos])).toEqual([
      ['bar', 100, ['bar allen', 'bar en allen rio negro']],
      ['jardin', 50, ['jardín allen centro']],
    ]);
    expect(mencionaLocalidad('farmacia neuquen capital', 'Neuquén')).toBe(true);
    expect(mencionaLocalidad('camping allentown pa', 'Allen')).toBe(false);
  });

  it('suma la zona, normaliza (primero = 100) y descarta rubros sin datos', () => {
    expect(zona.rubrosConDatos).toBe(2);
    expect(zona.top.map(r => [r.id, r.pos, r.interes])).toEqual([['gomeria', 1, 100], ['cerrajeria', 2, 86]]);
  });

  it('índice por localidad relativo a su propio máximo', () => {
    const gom = zona.top[0].porLocalidad;
    expect(gom).toEqual([{ localidad: 'Neuquén', interes: 100 }, { localidad: 'Plottier', interes: 50 }]);
  });

  it('frases: hasta 3, primero las de la localidad con más demanda, sin repetir', () => {
    expect(zona.top[0].ejemplos).toEqual(['gomeria 1 x', 'gomeria 2 x', 'gomeria x plottier']);
  });

  it('corta en topN', () => {
    expect(aggregateZone([{ localidad: 'x', analyzed: [a('a', 3), a('b', 2), a('c', 1)] }], 2).top).toHaveLength(2);
  });
});

describe('withCambios', () => {
  const top = [{ id: 'a', pos: 1 }, { id: 'b', pos: 2 }, { id: 'c', pos: 3 }];
  it('sin informe anterior no inventa cambios', () => {
    expect(withCambios(top, null).every(r => r.cambio === null && !r.nuevo)).toBe(true);
  });
  it('subió > 0, bajó < 0, nuevo si no estaba', () => {
    const r = withCambios(top, [{ id: 'b', pos: 1 }, { id: 'a', pos: 2 }]);
    expect(r.map(x => [x.id, x.cambio, x.nuevo])).toEqual([['a', 1, false], ['b', -1, false], ['c', null, true]]);
  });
});

describe('pickZona', () => {
  const zonas = [{ id: 'a', localidades: [1] }, { id: 'b', localidades: [1] }, { id: 'c', localidades: [1] }];
  it('la que hace más tiempo que no sale, respetando el cooldown', () => {
    const now = 100 * COOLDOWN_MS;
    expect(pickZona({ zonas, ultimaCorrida: { a: now - 1, b: now - 2 * COOLDOWN_MS, c: now - 3 * COOLDOWN_MS } }, now).id).toBe('c');
    expect(pickZona({ zonas, ultimaCorrida: { a: 5 } }, now).id).toBe('b');
  });
  it('nada si todas salieron esta semana', () => {
    expect(pickZona({ zonas, ultimaCorrida: { a: 10, b: 10, c: 10 } }, 20)).toBeNull();
  });
});

describe('post de LinkedIn', () => {
  const reporte = {
    zona: 'Alto Valle', localidades: ['Neuquén', 'Plottier'], createdAtMs: Date.UTC(2026, 9, 28, 21),
    top: [
      { id: 'g', label: 'Gomería', pos: 1, cambio: 0, ejemplos: ['gomeria 24 horas neuquen'], porLocalidad: [{ localidad: 'Neuquén', interes: 80 }, { localidad: 'Plottier', interes: 100 }] },
      { id: 'c', label: 'Cerrajería', pos: 2, cambio: 3 },
      { id: 'f', label: 'Ferretería', pos: 3, cambio: -1 },
    ],
  };
  const caption = buildDemandaCaption(reporte, 'abc');

  it('trae el podio, el que más subió, dónde se busca más, la frase real y el link', () => {
    expect(caption).toContain('¿Qué se busca en Google en Alto Valle?');
    expect(caption).toContain('🥇 Gomería');
    expect(caption).toContain('El que más subió: Cerrajería (+3 puestos)');
    expect(caption).toContain('Donde más se busca gomería: Plottier');
    expect(caption).toContain('"gomeria 24 horas neuquen"');
    expect(caption).toContain('https://marianoaliandri.com.ar/demanda/abc/');
    expect(caption).toContain('#AltoValle');
  });
});

describe('validateDemandaPatch', () => {
  it('arma ids y limpia localidades repetidas', () => {
    const { update } = validateDemandaPatch({ zonas: [{ nombre: ' Alto Valle ', localidades: [
      { provincia: 'Neuquén', localidad: 'Plottier' }, { provincia: 'Neuquén', localidad: 'Plottier' },
    ] }] });
    expect(update.zonas).toEqual([{ id: 'alto-valle', nombre: 'Alto Valle', localidades: [{ provincia: 'Neuquén', localidad: 'Plottier' }] }]);
  });
  it('rechaza zonas sin localidades, repetidas o sin nombre', () => {
    expect(validateDemandaPatch({ zonas: [{ nombre: 'X', localidades: [] }] }).error).toBeTruthy();
    expect(validateDemandaPatch({ zonas: [{ nombre: 'X', localidades: [{ provincia: 'a', localidad: 'b' }] }, { nombre: 'x', localidades: [{ provincia: 'a', localidad: 'b' }] }] }).error).toMatch(/repetida/);
    expect(validateDemandaPatch({ activo: 'si' }).error).toBeTruthy();
    expect(validateDemandaPatch({}).error).toBeTruthy();
  });
});

it('busquedaDe y zonaId', () => {
  expect(busquedaDe('Ciudad Autónoma de Buenos Aires')).toBe('CABA');
  expect(busquedaDe('Plottier')).toBe('Plottier');
  expect(zonaId('Córdoba')).toBe('cordoba');
});
