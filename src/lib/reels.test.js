import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);

import { createFakeDb } from '@/test/fakeDb';
import { siguientesTipos, primeraOracion, reelExplicador, reelRanking, reelDato, duracionEscena, captionReel } from './reels';
import { pcmToWav, sintetizar } from './geminiTts';
import { publicarReel } from './reelPublish';

describe('reels', () => {
  it('rotan los tipos a partir del último', () => {
    expect(siguientesTipos('explicador')).toEqual(['ranking', 'dato', 'explicador']);
    expect(siguientesTipos(undefined)).toEqual(['explicador', 'ranking', 'dato']);
  });

  it('primera oración o recorte prolijo', () => {
    expect(primeraOracion('Conecta a Claude con tus ventas. Y además con el stock.')).toBe('Conecta a Claude con tus ventas.');
    expect(primeraOracion('palabra '.repeat(40), 50).endsWith('…')).toBe(true);
  });

  it('explicador: hook, hasta 4 puntos y cierre que lleva a /aprende', () => {
    const r = reelExplicador({ titulo: 'T', serieNombre: 'S', slides: Array.from({ length: 6 }, (_, i) => ({ titulo: `P${i}`, texto: `Conecta tus ventas número ${i}. Más.` })) });
    expect(r.escenas.map(e => e.tipo)).toEqual(['hook', 'punto', 'punto', 'punto', 'punto', 'cierre']);
    expect(r.escenas[1].voz).toBe('P0. Conecta tus ventas número 0.');
    expect(r.escenas.at(-1).link).toBe('marianoaliandri.com.ar/aprende');
    expect(r.escenas.at(-1).voz).toContain('marianoaliandri punto com punto ar barra aprende');
  });

  it('ranking: top 5 con la frase real', () => {
    const top = ['Farmacia', 'Escuela', 'Veterinaria', 'Tienda', 'Hotel', 'Bar'].map((label, i) => ({ label, interes: 100 - i, ejemplos: i ? [] : ['farmacia neuquén capital'] }));
    const r = reelRanking({ zona: 'Alto Valle', top });
    expect(r.escenas[1].items).toHaveLength(5);
    expect(r.escenas[1].voz).toBe('Los cinco rubros más buscados son farmacia, escuela, veterinaria, tienda y hotel.');
    expect(r.escenas[2].voz).toContain('farmacia neuquén capital');
  });

  it('dato: los porcentajes más altos (≥ 20 %), nada si no hay datos', () => {
    const r = reelDato({ sitiosAuditados: 40, ciudades: ['Neuquén'], pctSinDescripcionEnGoogle: 68, pctSinFotoAlCompartir: 10, pctPuntajeBajo50: 45, pctSinSitemap: 80 });
    expect(r.escenas.filter(e => e.tipo === 'numero').map(e => e.valor)).toEqual([80, 68, 45]);
    expect(r.titulo).toBe('Revisé 40 webs de negocios de Neuquén');
    expect(reelDato(null)).toBeNull();
    expect(reelDato({ sitiosAuditados: 9, cantidadCiudades: 6, ciudades: ['A', 'B'], pctSinSitemap: 50 }).titulo).toBe('Revisé 9 webs de negocios de 6 ciudades');
    expect(reelDato({ sitiosAuditados: 5, pctSinSitemap: 5 })).toBeNull();
  });

  it('duración de escena: voz + respiro, con mínimo', () => {
    expect(duracionEscena(5)).toBe(5.7);
    expect(duracionEscena(1)).toBe(2.8);
  });

  it('caption con DM, link y máximo 5 hashtags', () => {
    const t = captionReel('explicador', { titulo: 'MCP en 30 segundos' }, { link: 'https://x/aprende/a/', hashtags: ['A', 'B', 'C', 'D'] });
    expect(t).toContain('Mandáselo a alguien que tenga un negocio');
    expect(t.trim().split('\n').at(-1).split(' ')).toHaveLength(5);
  });
});

describe('voz en off (Gemini TTS)', () => {
  it('WAV con cabecera correcta', () => {
    const wav = pcmToWav(Buffer.alloc(48000));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.length).toBe(48044);
  });

  it('si una key falla prueba la siguiente; si fallan todas, reintenta y después tira', async () => {
    const audio = Buffer.alloc(48000).toString('base64');
    let n = 0;
    const fetchImpl = async () => (++n === 1
      ? { ok: false, status: 503, json: async () => ({ error: { message: 'high demand' } }) }
      : { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: audio } }] } }] }) });
    const r = await sintetizar('hola', { keys: ['a', 'b'], fetchImpl });
    expect(r.segundos).toBe(1);
    const caida = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await expect(sintetizar('hola', { keys: ['a'], fetchImpl: caida, intentos: 2, wait: async () => {} })).rejects.toThrow(/falló/);
  });
});

describe('publicar reel', () => {
  it('cada red por separado y el error queda guardado', async () => {
    const { db } = createFakeDb({ 'reels/r1': { videoUrl: 'https://v.mp4', caption: 'c', estado: 'borrador' } });
    const r = await publicarReel(db, 'r1', { redes: ['instagram', 'facebook'], ig: async () => 'ig1', fb: async () => { throw new Error('sin permiso'); } });
    expect(r.redes).toEqual({ instagram: { ok: true, id: 'ig1' }, facebook: { ok: false, error: 'sin permiso' } });
    const doc = (await db.collection('reels').doc('r1').get()).data();
    expect(doc.estado).toBe('publicado');
    expect(doc.error).toBe('Facebook: sin permiso');
  });
});
