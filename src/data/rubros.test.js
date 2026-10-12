// src/data/rubros.test.js
import { describe, it, expect } from 'vitest';
import { RUBROS, CATEGORIAS_RUBROS, RUBRO_LABEL_EN, CATEGORIA_EN, rubroLabel, categoriaLabel } from './rubros.js';

describe('rubros', () => {
  it('todos los rubros y categorías tienen nombre en inglés', () => {
    expect(RUBROS.filter(r => !RUBRO_LABEL_EN[r.id]).map(r => r.id)).toEqual([]);
    expect(CATEGORIAS_RUBROS.filter(c => !CATEGORIA_EN[c])).toEqual([]);
  });

  it('rubroLabel y categoriaLabel según idioma', () => {
    const plomero = RUBROS.find(r => r.id === 'plumber');
    expect(rubroLabel(plomero, 'es')).toBe('Plomero');
    expect(rubroLabel(plomero, 'en')).toBe('Plumber');
    expect(rubroLabel(undefined, 'es')).toBe('');
    expect(categoriaLabel('Automotor', 'en')).toBe('Automotive');
    expect(categoriaLabel('Automotor', 'es')).toBe('Automotor');
  });

  it('Constructor se busca por texto (general_contractor no existe en Places API New)', () => {
    expect(RUBROS.find(r => r.id === 'general_contractor').query).toBe('constructora');
  });
});
