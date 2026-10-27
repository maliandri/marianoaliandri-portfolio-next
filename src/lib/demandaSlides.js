// Placas 1080x1350 de un informe de demanda: carrusel de Facebook + Instagram y páginas del PDF de
// LinkedIn (mismas imágenes). Mismo motor y tipografías que las tarjetas del bot de noticias
// (scripts/noticiaCard.mjs: satori + resvg, todo local y gratis).
import { PDFDocument } from 'pdf-lib';
import { h, renderTree, cleanTitle, CARD_WIDTH, CARD_HEIGHT, THEMES } from '../../scripts/noticiaCard.mjs';
import { fechaLarga } from './demandaReport.js';

const T = THEMES[0]; // cian / violeta
const W = CARD_WIDTH;
const PAD = 72;
const INNER = W - 2 * PAD;
const txt = (s, max = 60) => cleanTitle(s).slice(0, max);

function frame({ n, total, children }) {
  const header = h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
    h('div', {
      display: 'flex', alignItems: 'center', padding: '12px 24px', borderRadius: 999,
      backgroundColor: 'rgba(6,8,16,0.72)', border: `2px solid ${T.accent}`,
    }, [
      h('div', { width: 14, height: 14, borderRadius: 14, backgroundColor: T.accent, marginRight: 14 }, ''),
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 24, letterSpacing: 3, color: '#ffffff' }, 'QUÉ SE BUSCA EN GOOGLE'),
    ]),
    h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 26, color: 'rgba(255,255,255,0.6)' }, `${n}/${total}`),
  ]);
  const footer = h('div', {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 26,
    borderTop: '2px solid rgba(255,255,255,0.22)',
  }, [
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 26, color: 'rgba(255,255,255,0.75)' }, 'Índice de demanda · el primero = 100'),
    h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 26, color: T.accent }, 'marianoaliandri.com.ar/demanda'),
  ]);
  return h('div', { position: 'relative', display: 'flex', width: W, height: CARD_HEIGHT, backgroundColor: '#080a12' }, [
    h('div', { position: 'absolute', top: 0, left: 0, width: W, height: CARD_HEIGHT, backgroundImage: `linear-gradient(160deg, ${T.bgFrom} 0%, ${T.bgTo} 100%)` }, ''),
    h('div', { position: 'absolute', top: -260, right: -260, width: 700, height: 700, borderRadius: 700, backgroundColor: T.accent, opacity: 0.12 }, ''),
    h('div', {
      position: 'absolute', top: 0, left: 0, width: W, height: CARD_HEIGHT, padding: PAD,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }, [header, h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, children), footer]),
  ]);
}

const titulo = (s, size = 76) => h('div', {
  fontFamily: 'Inter Tight', fontWeight: 800, fontSize: size, lineHeight: 1.04, letterSpacing: -2, color: '#ffffff', marginBottom: 36,
}, s);
const sub = (s, extra = {}) => h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 30, lineHeight: 1.35, color: 'rgba(255,255,255,0.8)', ...extra }, s);

function cambioTxt(r) {
  if (r.nuevo) return 'nuevo';
  if (!r.cambio) return '';
  return r.cambio > 0 ? `+${r.cambio}` : `${r.cambio}`;
}

// Fila de ranking: puesto, rubro, barra del índice, valor y cambio.
function fila(r, { alto = 62 } = {}) {
  const track = 300;
  return h('div', { display: 'flex', alignItems: 'center', height: alto }, [
    h('div', { width: 64, fontFamily: 'Inter', fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.55)' }, String(r.pos)),
    h('div', { width: 380, fontFamily: 'Inter', fontWeight: 700, fontSize: 34, color: '#ffffff', overflow: 'hidden' }, txt(r.label, 22)),
    h('div', { display: 'flex', width: track, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', marginRight: 20 }, [
      h('div', { width: Math.max(8, Math.round(track * r.interes / 100)), height: 16, borderRadius: 8, backgroundColor: T.accent }, ''),
    ]),
    h('div', { width: 60, fontFamily: 'Inter', fontWeight: 700, fontSize: 28, color: '#ffffff', justifyContent: 'flex-end', display: 'flex' }, String(r.interes)),
    h('div', { width: 80, fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: r.cambio < 0 ? '#fca5a5' : '#86efac', justifyContent: 'flex-end', display: 'flex' }, cambioTxt(r)),
  ]);
}

// Para cada localidad, su rubro más buscado (desempate: el que va más arriba en la zona).
export function topPorLocalidad(reporte) {
  return reporte.localidades.map(loc => {
    let mejor = null;
    for (const r of reporte.top) {
      const v = (r.porLocalidad || []).find(p => p.localidad === loc)?.interes ?? 0;
      if (!mejor || v > mejor.v) mejor = { r, v };
    }
    return { localidad: loc, rubro: mejor?.r.label || '—' };
  });
}

// Árboles de las placas (sin numerar). Se exporta para testear qué placas salen.
export function slideTrees(reporte) {
  const { zona, localidades, top, createdAtMs } = reporte;
  const placas = [];

  placas.push([
    titulo(`¿Qué se busca en Google en ${txt(zona, 40)}?`, 92),
    localidades.length > 1 ? sub(txt(localidades.join(' · '), 150), { marginBottom: 24 }) : '',
    sub(`Ranking de los ${top.length} rubros con más demanda de búsqueda · ${fechaLarga(createdAtMs)}`),
    sub('Deslizá para ver el ranking', { marginTop: 56, color: T.accent, fontWeight: 700 }),
  ].filter(Boolean));

  placas.push([
    titulo('El podio', 72),
    ...top.slice(0, 3).map((r, i) => h('div', { display: 'flex', flexDirection: 'column', marginBottom: 40 }, [
      h('div', { display: 'flex', alignItems: 'baseline' }, [
        h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 84, color: T.accent, width: 90 }, String(i + 1)),
        h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 64, color: '#ffffff' }, txt(r.label, 24)),
      ]),
      r.ejemplos?.[0] ? sub(`“${txt(r.ejemplos[0], 70)}”`, { marginLeft: 90, fontSize: 30 }) : '',
    ].filter(Boolean))),
  ]);

  if (top.length > 3) placas.push([titulo('Puestos 4 a 10', 64), ...top.slice(3, 10).map(r => fila(r, { alto: 96 }))]);
  if (top.length > 10) placas.push([titulo('Puestos 11 a 20', 64), ...top.slice(10, 20).map(r => fila(r, { alto: 72 }))]);

  if (localidades.length > 1) {
    const filas = topPorLocalidad(reporte).slice(0, 9);
    placas.push([
      titulo('Lo más buscado en cada localidad', 64),
      ...filas.map(f => h('div', {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 76,
        borderBottom: '2px solid rgba(255,255,255,0.10)', width: INNER,
      }, [
        h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 34, color: 'rgba(255,255,255,0.8)' }, txt(f.localidad, 26)),
        h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 36, color: '#ffffff' }, txt(f.rubro, 22)),
      ])),
    ]);
  }

  const subieron = top.filter(r => r.cambio > 0).sort((a, b) => b.cambio - a.cambio).slice(0, 4);
  if (subieron.length) {
    placas.push([
      titulo('Los que más subieron desde el informe anterior', 64),
      ...subieron.map(r => h('div', { display: 'flex', alignItems: 'baseline', marginBottom: 28 }, [
        h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 56, color: '#86efac', width: 170 }, `+${r.cambio}`),
        h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 56, color: '#ffffff' }, txt(r.label, 22)),
      ])),
    ]);
  }

  placas.push([
    titulo('¿Tu rubro está en la lista?', 84),
    sub('Hay gente buscándolo en Google ahora mismo. La pregunta es si te encuentra a vos o a tu competencia.', { fontSize: 36, marginBottom: 40 }),
    sub(`Los ${top.length} rubros, las frases reales y el detalle por localidad:`, { fontSize: 30 }),
    sub('marianoaliandri.com.ar/demanda', { fontSize: 40, fontWeight: 700, color: T.accent, marginTop: 12 }),
    sub('Sitios y sistemas a medida — Mariano Aliandri', { fontSize: 28, marginTop: 56, color: 'rgba(255,255,255,0.6)' }),
  ]);

  return placas;
}

// PNGs de las placas, numeradas "n/total".
export async function renderDemandaSlides(reporte) {
  const placas = slideTrees(reporte);
  const out = [];
  for (let i = 0; i < placas.length; i++) {
    out.push(await renderTree(frame({ n: i + 1, total: placas.length, children: placas[i] }), 'feed'));
  }
  return out;
}

// PDF para el post de documento de LinkedIn: una página por placa, del mismo tamaño.
export async function slidesToPdf(pngs, { title } = {}) {
  const pdf = await PDFDocument.create();
  if (title) pdf.setTitle(title);
  pdf.setAuthor('Mariano Aliandri');
  for (const png of pngs) {
    const img = await pdf.embedPng(png);
    const page = pdf.addPage([CARD_WIDTH, CARD_HEIGHT]);
    page.drawImage(img, { x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT });
  }
  return Buffer.from(await pdf.save());
}
