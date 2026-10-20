import { describe, it, expect } from 'vitest';
import { parseTalles, parsePrecioMenor, parsePrecioArs, parseCodigo, limpiarTitulo } from './proveedorParse';

describe('parseTalles', () => {
  it('rango de letras', () => {
    expect(parseTalles('TALLE XS AL XL')).toEqual(['XS', 'S', 'M', 'L', 'XL']);
    expect(parseTalles('TALLE S AL 2XL $13.500 por mayor')).toEqual(['S', 'M', 'L', 'XL', '2XL']);
    expect(parseTalles('TALLE 3XL AL 6XL $15.274 por mayor')).toEqual(['3XL', '4XL', '5XL', '6XL']);
    expect(parseTalles('TALLE M AL XXL')).toEqual(['M', 'L', 'XL', '2XL']);
  });
  it('rango numérico', () => {
    expect(parseTalles('Talles 1 al 5 $7.575 POR MAYOR')).toEqual(['1', '2', '3', '4', '5']);
    expect(parseTalles('TALLE 24 al 30 $20.300 por mayor')).toEqual(['24', '26', '28', '30']);
  });
  it('varios rangos por color', () => {
    expect(parseTalles('Talles 1 al 4 BORDO TALLE 1 AL 3 GRIS VAPLEX TALLE 2 Y 3 MARRON 1 Y 3'))
      .toEqual(['1', '2', '3', '4']);
  });
  it('talle único', () => {
    expect(parseTalles('Talles 1 Lycra 40 $4.500 POR MAYOR')).toEqual(['1']);
    expect(parseTalles('TALLE ESPECIAL')).toEqual(['ESPECIAL']);
  });
  it('sin talles', () => {
    expect(parseTalles('$11.500 por mayor $19.100 por menor')).toEqual([]);
    expect(parseTalles('')).toEqual([]);
  });
});

describe('precios', () => {
  it('por menor', () => {
    expect(parsePrecioMenor('$21.300 por mayor\n$35.300 por menor')).toBe(35300);
    expect(parsePrecioMenor('$7.575 POR MAYOR $12.221 POR MENOR')).toBe(12221);
    expect(parsePrecioMenor('$14.508,75 por mayor $21.961,88 por menor')).toBe(21961.88);
    expect(parsePrecioMenor('sin precio')).toBeNull();
  });
  it('ARS', () => {
    expect(parsePrecioArs('ARS 21,300.00')).toBe(21300);
    expect(parsePrecioArs('ARS 0.00')).toBe(0);
  });
});

describe('título', () => {
  it('código y limpieza', () => {
    expect(parseCodigo('📦MLL1054 CALZA POCKET I-RUN $21.300 POR MAYOR')).toBe('MLL1054');
    expect(parseCodigo('💗 2007 BABUCHA LYCRA')).toBe('2007');
    expect(parseCodigo('COMBO EMPRENDEDOR 18 PRENDAS')).toBeNull();
    expect(limpiarTitulo('👉🏻INFORMACION GENERAL')).toBe('INFORMACION GENERAL');
  });
});
