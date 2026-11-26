import { describe, it, expect } from 'vitest';
import {
  auditoriaLink, posicionEnAuditoria, normalizarWhatsapp, whatsappUrl, mensajeWhatsapp, mensajeDesdeInforme,
} from './auditPitch';

const results = [
  { id: 'a', nombre: 'Uno', seoScore: 80 },
  { id: 'b', nombre: 'Dos', seoScore: 40 },
  { id: 'c', nombre: 'Tres', seoScore: 60 },
  { id: 'd', nombre: 'Sin score', seoScore: null },
];

describe('auditoriaLink', () => {
  it('arma el link personal con barra final, clave y ?para', () => {
    expect(auditoriaLink('X1', 'ChIJ abc', 'k-1')).toBe('https://marianoaliandri.com.ar/auditorias/X1/?k=k-1&para=ChIJ%20abc');
    expect(auditoriaLink('X1', null, 'k-1')).toBe('https://marianoaliandri.com.ar/auditorias/X1/?k=k-1');
    expect(auditoriaLink('X1')).toBe('https://marianoaliandri.com.ar/auditorias/X1/');
  });
});

describe('posicionEnAuditoria', () => {
  it('calcula puesto, total y promedio entre los que tienen score', () => {
    expect(posicionEnAuditoria(results, 'b')).toEqual({ puesto: 3, total: 3, score: 40, promedio: 60, mejorScore: 80 });
    expect(posicionEnAuditoria(results, 'a').puesto).toBe(1);
  });
  it('null si no está o no tiene score', () => {
    expect(posicionEnAuditoria(results, 'zz')).toBeNull();
    expect(posicionEnAuditoria(results, 'd')).toBeNull();
  });
});

describe('whatsapp', () => {
  it('normaliza números argentinos', () => {
    expect(normalizarWhatsapp('+54 9 299 541-4422')).toBe('5492995414422');
    expect(normalizarWhatsapp('2995414422')).toBe('5492995414422');
    expect(normalizarWhatsapp('')).toBeNull();
  });
  it('arma wa.me con el texto', () => {
    expect(whatsappUrl('5492995414422', 'hola que tal')).toBe('https://wa.me/5492995414422?text=hola%20que%20tal');
  });
});

describe('mensajeWhatsapp', () => {
  it('nombra al negocio, su puesto y lleva el link', () => {
    const t = mensajeWhatsapp({
      neg: { id: 'b', nombre: 'Dos', ciudad: 'Neuquén' },
      auditoria: { config: { tiposLabels: ['Aberturas'] }, results },
      link: 'https://marianoaliandri.com.ar/auditorias/X1/?para=b',
    });
    expect(t).toContain('Dos');
    expect(t).toContain('3° de 3');
    expect(t).toContain('aberturas en Neuquén');
    expect(t).toContain('?para=b');
  });
  it('sin score no inventa puesto', () => {
    const t = mensajeWhatsapp({ neg: { id: 'd', nombre: 'Sin score' }, auditoria: { results }, link: 'L' });
    expect(t).not.toContain('°');
  });
});

it('mensajeDesdeInforme', () => {
  expect(mensajeDesdeInforme('Dos')).toContain('soy de Dos');
  expect(mensajeDesdeInforme()).toContain('auditorías');
});
