import { describe, it, expect } from 'vitest';
import {
  cleanTitle, titleFontSize, pickTheme, THEMES, renderNoticiaCard, CARD_WIDTH, CARD_HEIGHT,
} from './noticiaCard.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(buf) {
  // El chunk IHDR guarda ancho y alto (4 bytes big-endian cada uno) desde el byte 16.
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('cleanTitle', () => {
  it('saca emojis y colapsa espacios, pero conserva tildes, ñ y comillas tipográficas', () => {
    expect(cleanTitle('  La IA 🤖 cambió   todo: “año” nuevo  ')).toBe('La IA cambió todo: “año” nuevo');
  });

  it('recorta títulos largos en un límite de palabra y agrega puntos suspensivos', () => {
    const long = 'palabra '.repeat(40);
    const out = cleanTitle(long);
    expect(out.length).toBeLessThanOrEqual(150);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it('tolera null/undefined', () => {
    expect(cleanTitle(null)).toBe('');
    expect(cleanTitle(undefined)).toBe('');
  });
});

describe('titleFontSize', () => {
  it('achica la letra a medida que el titular es más largo', () => {
    const sizes = [40, 90, 120, 149].map(titleFontSize);
    expect(sizes).toEqual([84, 72, 62, 54]);
  });
});

describe('pickTheme', () => {
  it('es determinístico por tópico y siempre devuelve un color de la paleta', () => {
    expect(pickTheme('topic-abc')).toBe(pickTheme('topic-abc'));
    expect(THEMES).toContain(pickTheme('otro-topico'));
    expect(THEMES).toContain(pickTheme(undefined));
  });
});

describe('renderNoticiaCard', () => {
  it('genera un PNG de 1080x1350 con fondo de marca', async () => {
    const { png, usedPhoto } = await renderNoticiaCard({
      title: 'Un titular de prueba con tildes: más rápido, así, año',
      topicLabel: 'Inteligencia artificial',
      topicId: 't1',
      source: 'Infobae',
      photoDataUri: null,
    });
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(pngSize(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    expect(usedPhoto).toBe(false);
  });

  it('si la foto es inválida cae al fondo de marca en vez de fallar', async () => {
    const { png, usedPhoto } = await renderNoticiaCard({
      title: 'Titular',
      topicLabel: 'Tópico',
      topicId: 't2',
      photoDataUri: 'data:image/jpeg;base64,AAAA',
    });
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(usedPhoto).toBe(false);
  });
});
