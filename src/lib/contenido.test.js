import { describe, it, expect } from 'vitest';
import { pickSerie, statsAuditorias, buildPrompt, parseContenido, buildCaption, validateContenidoPatch } from './contenido';
import { slideTrees } from './contenidoSlides';
import { generarPieza } from './contenidoRun';
import { SERIES_SEMILLA } from '@/data/contenidoSeries';

const pieza = {
  titulo: 'MCP: el USB-C entre Claude y tu negocio',
  slides: Array.from({ length: 4 }, (_, i) => ({ titulo: `Slide ${i}`, texto: `Texto de la slide ${i}` })),
  caption: 'Un caption.',
  cuerpo: ['Primer párrafo con suficiente texto para pasar el filtro mínimo.', 'Segundo párrafo con suficiente texto para pasar el filtro.'],
  hashtags: ['IAParaPymes', 'Neuquén'],
};

describe('bot de contenido', () => {
  it('las series semilla son válidas para el PATCH del admin', () => {
    expect(validateContenidoPatch({ series: SERIES_SEMILLA }).error).toBeUndefined();
  });

  it('rota: la serie activa que hace más tiempo que no sale', () => {
    const series = [{ id: 'a', orden: 0 }, { id: 'b', orden: 1 }, { id: 'c', orden: 2, activo: false }];
    expect(pickSerie(series, {}).id).toBe('a');
    expect(pickSerie(series, { a: 10 }).id).toBe('b');
    expect(pickSerie(series, { a: 10, b: 5 }).id).toBe('b');
    expect(pickSerie([{ id: 'x', activo: false }], {})).toBeNull();
  });

  it('parsea el JSON de la IA (aunque venga con ```), recorta y descarta lo incompleto', () => {
    const c = parseContenido('```json\n' + JSON.stringify({ ...pieza, titulo: 'x'.repeat(200), hashtags: ['#Uno', 'dos tres', 'a', 'b', 'c'] }) + '\n```');
    expect(c.titulo.length).toBeLessThanOrEqual(90);
    expect(c.hashtags).toEqual(['Uno', 'dostres', 'a', 'b']);
    expect(() => parseContenido(JSON.stringify({ ...pieza, slides: pieza.slides.slice(0, 2) }))).toThrow(/incompleta/);
    expect(() => parseContenido('no es json')).toThrow(/JSON/);
  });

  it('caption: pide mandarlo por DM, lleva a la página propia y no más de 5 hashtags', () => {
    const t = buildCaption(pieza, 'abc');
    expect(t).toContain('Mandáselo a alguien que tenga un negocio');
    expect(t).toContain('https://marianoaliandri.com.ar/aprende/abc/');
    expect(t).toContain('#NegociosLocales #IAParaPymes #Neuquén');
  });

  it('el prompt lleva lo ya publicado y los datos reales solo si hay', () => {
    const p = buildPrompt(SERIES_SEMILLA[0], { recientes: ['Título viejo'], datos: { sitiosAuditados: 40 } });
    expect(p).toContain('- Título viejo');
    expect(p).toContain('"sitiosAuditados":40');
    expect(buildPrompt(SERIES_SEMILLA[0])).toContain('No inventes números');
  });

  it('stats de auditorías: porcentajes reales, sin nombres; nada si hay pocos datos', () => {
    const fila = (seo, meta) => ({ nombre: 'Negocio', seoScore: seo, metaDesc: meta, hasSitemap: false, hasOG: true, ciudad: 'Neuquén' });
    const s = statsAuditorias([{ config: { tiposLabels: ['Ferretería'] }, results: [fila(30, ''), fila(40, 'ok'), fila(60, ''), fila(80, 'ok'), fila(20, '')] }]);
    expect(s).toMatchObject({ sitiosAuditados: 5, puntajeSeoPromedio: 46, pctPuntajeBajo50: 60, pctSinDescripcionEnGoogle: 60, pctSinSitemap: 100, pctSinFotoAlCompartir: 0 });
    expect(JSON.stringify(s)).not.toContain('Negocio');
    expect(statsAuditorias([{ results: [fila(1, '')] }])).toBeNull();
  });

  it('placas: portada + una por slide + cierre', () => {
    expect(slideTrees(pieza, { ctaLabel: 'Ver', ctaPath: '/ia-para/' })).toHaveLength(6);
  });

  it('si una IA falla o devuelve algo inválido, pasa a la siguiente', async () => {
    const r = await generarPieza('p', [
      ['caida', async () => { throw new Error('503'); }],
      ['mala', async () => 'no json'],
      ['buena', async () => JSON.stringify(pieza)],
    ]);
    expect(r.proveedor).toBe('buena');
    await expect(generarPieza('p', [['caida', async () => { throw new Error('503'); }]])).rejects.toThrow(/caida: 503/);
  });
});

describe('stats de auditorías: sin repetidos', () => {
  it('cuenta cada dominio una vez y normaliza las ciudades', () => {
    const fila = (url, ciudad) => ({ siteUrl: url, seoScore: 40, metaDesc: '', ciudad });
    const a = { results: [fila('https://www.a.com/', 'Neuquén'), fila('http://a.com/contacto', 'Neuquén, Neuquén'), fila('https://b.com', 'Neuquén, Neuquén'), fila('https://c.com', 'Cipolletti'), fila('https://d.com', 'Plottier'), fila('https://e.com', 'Allen')] };
    const s = statsAuditorias([a, a]);
    expect(s.sitiosAuditados).toBe(5);
    expect(s.ciudades).toEqual(['Neuquén', 'Cipolletti', 'Plottier', 'Allen']);
    expect(s.cantidadCiudades).toBe(4);
  });
});
