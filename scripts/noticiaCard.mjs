// Genera la imagen (tarjeta 1080x1350) que acompaña cada noticia del bot.
// Satori convierte un árbol tipo HTML/CSS a SVG y resvg lo pasa a PNG — todo
// corre dentro de GitHub Actions, sin servicios externos ni costo.
// Tipografías: Inter / Inter Tight (licencia OFL), archivos .woff en scripts/fonts/
// (satori no lee WOFF2).
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350; // 4:5, el formato vertical más grande que acepta Instagram en el feed

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');

let fontsCache = null;
function loadFonts() {
  if (!fontsCache) {
    const read = f => fs.readFileSync(path.join(FONT_DIR, f));
    fontsCache = [
      { name: 'Inter Tight', data: read('inter-tight-800.woff'), weight: 800, style: 'normal' },
      { name: 'Inter', data: read('inter-500.woff'), weight: 500, style: 'normal' },
      { name: 'Inter', data: read('inter-700.woff'), weight: 700, style: 'normal' },
    ];
  }
  return fontsCache;
}

// Cada tópico toma un color de esta paleta según su id (siempre el mismo para el mismo tópico).
export const THEMES = [
  { accent: '#22d3ee', bgFrom: '#0b1220', bgTo: '#2a1f6b' }, // cian / violeta
  { accent: '#f87171', bgFrom: '#160a0a', bgTo: '#5a1414' }, // rojo
  { accent: '#75aadb', bgFrom: '#0a1626', bgTo: '#1d4f82' }, // celeste
  { accent: '#fbbf24', bgFrom: '#171006', bgTo: '#5c3a08' }, // ámbar
  { accent: '#4ade80', bgFrom: '#07150d', bgTo: '#0f4a2c' }, // verde
  { accent: '#f472b6', bgFrom: '#180a14', bgTo: '#5b1746' }, // rosa
];

export function pickTheme(topicId) {
  const hash = crypto.createHash('sha256').update(String(topicId ?? '')).digest();
  return THEMES[hash[0] % THEMES.length];
}

// Las tipografías no cubren emojis ni alfabetos no latinos: en vez de dibujar
// cuadraditos, se sacan. Se conservan letras latinas (con tildes/ñ), números,
// puntuación y las comillas/guiones tipográficos.
const UNSUPPORTED_CHARS = /[^ -~ -ɏ‐-‧‰-›€]/g;
const MAX_TITLE_CHARS = 150;

export function cleanTitle(raw) {
  let s = String(raw ?? '').replace(UNSUPPORTED_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > MAX_TITLE_CHARS) {
    const cut = s.slice(0, MAX_TITLE_CHARS - 1);
    const lastSpace = cut.lastIndexOf(' ');
    s = `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
  }
  return s;
}

// Titulares largos necesitan letra más chica para no comerse la tarjeta.
export function titleFontSize(length) {
  if (length <= 70) return 84;
  if (length <= 100) return 72;
  if (length <= 130) return 62;
  return 54;
}

const h = (type, style, children) => ({ type, props: { style, children } });
const FULL = { position: 'absolute', top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT };

function buildCardTree({ title, topicLabel, source, theme, photoDataUri }) {
  const layers = [];

  if (photoDataUri) {
    layers.push({
      type: 'img',
      props: { src: photoDataUri, width: CARD_WIDTH, height: CARD_HEIGHT, style: { ...FULL, objectFit: 'cover' } },
    });
    layers.push(h('div', {
      ...FULL,
      backgroundImage: 'linear-gradient(180deg, rgba(6,8,16,0.55) 0%, rgba(6,8,16,0.10) 28%, rgba(6,8,16,0.86) 62%, rgba(6,8,16,0.98) 100%)',
    }, ''));
  } else {
    layers.push(h('div', { ...FULL, backgroundImage: `linear-gradient(160deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)` }, ''));
    layers.push(h('div', {
      position: 'absolute', top: -260, right: -260, width: 700, height: 700, borderRadius: 700,
      backgroundColor: theme.accent, opacity: 0.14,
    }, ''));
  }

  const label = cleanTitle(topicLabel).toUpperCase().slice(0, 34);
  const top = h('div', { display: 'flex', alignItems: 'center' }, [
    h('div', {
      display: 'flex', alignItems: 'center', padding: '14px 26px', borderRadius: 999,
      backgroundColor: 'rgba(6,8,16,0.72)', border: `2px solid ${theme.accent}`,
    }, [
      h('div', { width: 16, height: 16, borderRadius: 16, backgroundColor: theme.accent, marginRight: 16 }, ''),
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 26, letterSpacing: 3, color: '#ffffff' }, label),
    ]),
  ]);

  const footerLeft = source ? `Fuente: ${cleanTitle(source).slice(0, 40)}` : ' ';
  const bottom = h('div', { display: 'flex', flexDirection: 'column' }, [
    h('div', { width: 120, height: 10, borderRadius: 10, backgroundColor: theme.accent, marginBottom: 40 }, ''),
    h('div', {
      fontFamily: 'Inter Tight', fontWeight: 800, fontSize: titleFontSize(title.length), lineHeight: 1.04,
      letterSpacing: -2, color: '#ffffff',
    }, title),
    h('div', {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 52, paddingTop: 30,
      borderTop: '2px solid rgba(255,255,255,0.22)',
    }, [
      h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 28, color: 'rgba(255,255,255,0.82)' }, footerLeft),
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 28, color: theme.accent }, 'marianoaliandri.com.ar'),
    ]),
  ]);

  const content = h('div', {
    ...FULL, padding: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  }, [top, bottom]);

  return h('div', { position: 'relative', display: 'flex', width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#080a12' }, [...layers, content]);
}

async function renderTree(tree) {
  const svg = await satori(tree, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng();
}

// Devuelve { png: Buffer, usedPhoto: boolean }. Si la foto no se puede dibujar
// (formato que satori no entiende, archivo corrupto), cae al fondo de marca
// en vez de fallar: la noticia siempre tiene imagen.
export async function renderNoticiaCard({ title, topicLabel, topicId, source, photoDataUri }) {
  const theme = pickTheme(topicId);
  const base = { title: cleanTitle(title), topicLabel, source, theme };

  if (photoDataUri) {
    try {
      return { png: await renderTree(buildCardTree({ ...base, photoDataUri })), usedPhoto: true };
    } catch {
      // se sigue con el fondo de marca
    }
  }
  return { png: await renderTree(buildCardTree({ ...base, photoDataUri: null })), usedPhoto: false };
}
