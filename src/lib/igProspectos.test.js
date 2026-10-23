import { describe, it, expect } from 'vitest';
import { hallazgoPrincipal, dmTemplate, cleanDm, prospectoFromLead, buildDmPrompt, MAX_DM_CHARS } from './igProspectos.js';

const base = { id: 'p1', nombre: 'Mueblería Sur', ciudad: 'Neuquén', tipo: 'Mueblería', instagram: 'muebleriasur' };

describe('hallazgoPrincipal', () => {
  it('sin web lo dice primero', () => {
    expect(hallazgoPrincipal(base)).toMatch(/no tienen página web/);
  });

  it('web vieja antes que detalles técnicos', () => {
    const anio = new Date().getFullYear() - 3;
    expect(hallazgoPrincipal({ ...base, siteUrl: 'https://x.com', lastUpdated: `${anio}-05-01`, metaDesc: null }))
      .toMatch(String(anio));
  });

  it('sin meta description', () => {
    expect(hallazgoPrincipal({ ...base, siteUrl: 'https://x.com', metaDesc: null, hasOG: true })).toMatch(/descripción/);
  });

  it('web en buen estado → null', () => {
    expect(hallazgoPrincipal({ ...base, siteUrl: 'https://x.com', metaDesc: 'ok', hasOG: true, seoScore: 90 })).toBe(null);
  });
});

describe('dmTemplate / prompt', () => {
  it('la plantilla nombra al negocio y termina en pregunta', () => {
    const dm = dmTemplate(base);
    expect(dm).toContain('Mueblería Sur');
    expect(dm.trim().endsWith('?')).toBe(true);
    expect(dm.length).toBeLessThanOrEqual(MAX_DM_CHARS);
  });

  it('el prompt lleva nombre, rubro y hallazgo', () => {
    const p = buildDmPrompt(base);
    expect(p).toContain('Mueblería Sur');
    expect(p).toContain('Mueblería');
    expect(p).toMatch(/no tienen página web/);
  });
});

describe('cleanDm', () => {
  it('saca comillas envolventes', () => {
    expect(cleanDm('"Hola!"')).toBe('Hola!');
  });

  it('recorta en un final de oración si se pasa', () => {
    const largo = 'Hola, esto es una oración bastante larga para probar. '.repeat(20);
    const out = cleanDm(largo);
    expect(out.length).toBeLessThanOrEqual(MAX_DM_CHARS);
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('prospectoFromLead', () => {
  it('guarda solo lo necesario', () => {
    const p = prospectoFromLead({ ...base, phone: '123', seoScore: 40, siteUrl: 'https://x.com' });
    expect(p).toEqual({ handle: 'muebleriasur', placeId: 'p1', nombre: 'Mueblería Sur', ciudad: 'Neuquén', tipo: 'Mueblería', siteUrl: 'https://x.com', seoScore: 40 });
  });
});
