import { describe, it, expect } from 'vitest';
import { IA_NICHOS, getNicho, waLink } from './iaNichos';
import sitemap from '@/app/sitemap';

describe('iaNichos', () => {
  it('hay al menos 8 nichos, con slug único en kebab-case', () => {
    expect(IA_NICHOS.length).toBeGreaterThanOrEqual(8);
    const slugs = IA_NICHOS.map(n => n.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('cada nicho trae lo que necesita la página', () => {
    for (const n of IA_NICHOS) {
      expect(n.nombre, n.slug).toBeTruthy();
      expect(n.pregunta.endsWith('?'), n.slug).toBe(true);
      expect(n.herramienta, n.slug).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(n.respuesta.columnas.length, n.slug).toBeGreaterThanOrEqual(2);
      for (const fila of n.respuesta.filas) expect(fila.length, n.slug).toBe(n.respuesta.columnas.length);
      expect(n.respuesta.cierre, n.slug).toBeTruthy();
      expect(n.tareas.length, n.slug).toBeGreaterThanOrEqual(4);
      expect(n.tareas.some(t => t.tipo === 'accion'), n.slug).toBe(true);
      for (const t of n.tareas) expect(['consulta', 'accion']).toContain(t.tipo);
      expect(n.sistemas.length, n.slug).toBeGreaterThanOrEqual(2);
      // El layout agrega " | Mariano Aliandri" (19): con 42 queda en ~60, lo que muestra Google.
      expect(n.seo.title.length, n.slug).toBeLessThanOrEqual(42);
      expect(n.seo.description.length, n.slug).toBeLessThanOrEqual(160);
    }
  });

  it('getNicho por slug', () => {
    expect(getNicho(IA_NICHOS[0].slug)).toBe(IA_NICHOS[0]);
    expect(getNicho('no-existe')).toBeNull();
  });

  it('el link de WhatsApp lleva el mensaje del nicho', () => {
    const url = new URL(waLink(IA_NICHOS[0]));
    expect(url.origin).toBe('https://wa.me');
    expect(url.searchParams.get('text')).toContain(IA_NICHOS[0].nombre);
  });

  it('el índice y cada nicho están en el sitemap, con barra final', () => {
    const urls = sitemap().map(e => e.url);
    expect(urls).toContain('https://marianoaliandri.com.ar/ia-para/');
    for (const n of IA_NICHOS) expect(urls).toContain(`https://marianoaliandri.com.ar/ia-para/${n.slug}/`);
  });
});
