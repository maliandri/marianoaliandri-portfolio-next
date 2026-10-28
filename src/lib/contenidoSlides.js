// Placas 1080x1350 de una pieza del bot de contenido: portada, una por slide y cierre con el link.
// Van como carrusel a Facebook + Instagram y como páginas del PDF de LinkedIn. Mismo motor y
// tipografías que las tarjetas del bot de noticias (scripts/noticiaCard.mjs: satori + resvg).
import { h, renderTree, CARD_WIDTH as W, CARD_HEIGHT as H, THEMES } from '../../scripts/noticiaCard.mjs';

const T = THEMES[0]; // cian / violeta, el de la marca
const PAD = 80;
// Sin cleanTitle para los textos: recorta a 150 caracteres (es para titulares de noticias).
// Se sacan solo los emojis, que las tipografías no tienen.
const txt = (s, max) => String(s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);

function frame({ n, total, serie, children }) {
  const header = h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
    h('div', {
      display: 'flex', alignItems: 'center', padding: '12px 24px', borderRadius: 999,
      backgroundColor: 'rgba(6,8,16,0.72)', border: `2px solid ${T.accent}`,
    }, [
      h('div', { width: 14, height: 14, borderRadius: 14, backgroundColor: T.accent, marginRight: 14 }, ''),
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 24, letterSpacing: 3, color: '#ffffff' }, txt(serie, 32).toUpperCase()),
    ]),
    h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 26, color: 'rgba(255,255,255,0.6)' }, `${n}/${total}`),
  ]);
  const footer = h('div', {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 26,
    borderTop: '2px solid rgba(255,255,255,0.22)',
  }, [
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 26, color: 'rgba(255,255,255,0.75)' }, 'Mariano Aliandri · sistemas a medida'),
    h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 26, color: T.accent }, 'marianoaliandri.com.ar'),
  ]);
  return h('div', { position: 'relative', display: 'flex', width: W, height: H, backgroundColor: '#080a12' }, [
    h('div', { position: 'absolute', top: 0, left: 0, width: W, height: H, backgroundImage: `linear-gradient(160deg, ${T.bgFrom} 0%, ${T.bgTo} 100%)` }, ''),
    h('div', { position: 'absolute', top: -260, right: -260, width: 700, height: 700, borderRadius: 700, backgroundColor: T.accent, opacity: 0.12 }, ''),
    h('div', {
      position: 'absolute', top: 0, left: 0, width: W, height: H, padding: PAD,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }, [header, h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, children), footer]),
  ]);
}

const grande = (s, size) => h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: size, lineHeight: 1.06, letterSpacing: -2, color: '#ffffff' }, s);
const texto = (s, extra = {}) => h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 40, lineHeight: 1.38, color: 'rgba(255,255,255,0.86)', ...extra }, s);
const tamTitulo = (len) => (len <= 40 ? 96 : len <= 65 ? 84 : 72);

// Contenido de cada placa (sin numerar). Se exporta para testear.
export function slideTrees(c, { ctaLabel, ctaPath }) {
  const portada = [
    grande(txt(c.titulo, 90), tamTitulo(c.titulo.length)),
    texto('Deslizá para ver más', { marginTop: 56, color: T.accent, fontWeight: 700, fontSize: 34 }),
  ];
  const medio = c.slides.map((s, i) => [
    h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 120, color: T.accent, lineHeight: 1 }, String(i + 1)),
    h('div', { display: 'flex', marginTop: 28, marginBottom: 32 }, [grande(txt(s.titulo, 70), 64)]),
    texto(txt(s.texto, 240)),
  ]);
  const cierre = [
    grande('¿Te sirvió?', 92),
    texto('Mandáselo a alguien que tenga un negocio.', { marginTop: 28, marginBottom: 56 }),
    texto(`${txt(ctaLabel, 40)}:`, { fontSize: 34 }),
    texto(`marianoaliandri.com.ar${ctaPath}`.replace(/\/$/, ''), { fontSize: 42, fontWeight: 700, color: T.accent, marginTop: 10 }),
  ];
  return [portada, ...medio, cierre];
}

export async function renderContenidoSlides(c, cta) {
  const placas = slideTrees(c, cta);
  const out = [];
  for (let i = 0; i < placas.length; i++) {
    out.push(await renderTree(frame({ n: i + 1, total: placas.length, serie: c.serieNombre || '', children: placas[i] }), 'feed'));
  }
  return out;
}
