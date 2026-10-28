import { describe, it, expect } from 'vitest';
import { buildPromptGuiones, parseGuiones, guionesHtml } from './guiones';

const guion = (t) => ({ titulo: t, gancho: 'Gancho', textoEnPantalla: 'Texto', tomas: [{ decir: 'a', mostrar: 'b' }, { decir: 'c', mostrar: 'd' }], cierre: 'Cierre', caption: 'Caption', duracion: '30 s' });

describe('guiones semanales', () => {
  it('el prompt lleva los datos reales y los temas a no repetir', () => {
    const p = buildPromptGuiones({ series: [{ nombre: 'MCP en 30 segundos' }], auditorias: { pctSinSitemap: 80 }, demanda: { zona: 'Alto Valle', top: ['Farmacia'], frase: 'farmacia de turno' }, recientes: ['Viejo'] });
    expect(p).toContain('MCP en 30 segundos');
    expect(p).toContain('"pctSinSitemap":80');
    expect(p).toContain('Alto Valle');
    expect(p).toContain('Viejo');
  });

  it('parsea, descarta los incompletos y exige al menos 2', () => {
    const r = parseGuiones('```json\n' + JSON.stringify({ guiones: [guion('A'), guion('B'), { titulo: 'roto' }, guion('C')] }) + '```');
    expect(r.guiones.map(g => g.titulo)).toEqual(['A', 'B', 'C']);
    expect(() => parseGuiones(JSON.stringify({ guiones: [guion('A')] }))).toThrow(/menos de 2/);
  });

  it('el mail escapa el HTML', () => {
    const html = guionesHtml([guion('<b>x</b>'), guion('B')]);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('REEL 2');
  });
});
