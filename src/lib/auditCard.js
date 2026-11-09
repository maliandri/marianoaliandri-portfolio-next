// Tarjeta 1080x1350 (4:5) de una auditoría para las redes: título, tres números y la distribución del
// SEO. Se DIBUJA en el servidor (satori + resvg, igual que las placas del bot de contenido), así sale
// igual en Instagram, Facebook y LinkedIn y no depende de sacar una captura de la página. El mapa y la
// tabla están en el informe: la tarjeta lleva ahí.
import { h, renderTree, CARD_WIDTH as W, CARD_HEIGHT as H, THEMES } from '../../scripts/noticiaCard.mjs';

const T = THEMES[0]; // cian / violeta, el de la marca
const PAD = 72;
const INNER = W - PAD * 2; // 936

const COLOR_DEBIL = '#ef4444';
const COLOR_MEJORABLE = '#f59e0b';
const COLOR_OK = '#22c55e';

// Las tipografías no tienen emojis: se sacan.
const txt = (s, max) => String(s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);

// Lista de localidades que entre en dos líneas: si no entra, se corta en un separador y se agrega
// "+N más" (nunca a mitad de palabra).
export function resumirLugar(lugar, max = 64) {
  const partes = txt(lugar, 400).split(' · ').filter(Boolean);
  if (partes.join(' · ').length <= max) return partes.join(' · ');
  const out = [];
  for (const p of partes) {
    const resto = partes.length - out.length - 1;
    if ([...out, p].join(' · ').length + (resto > 0 ? ` · +${resto} más`.length : 0) > max && out.length) break;
    out.push(p);
  }
  const faltan = partes.length - out.length;
  return faltan > 0 ? `${out.join(' · ')} · +${faltan} más` : out.join(' · ');
}

// Cuántos sitios caen en cada tramo (mismos cortes que el informe: <40, 40–69, 70+).
export function distribucion(results) {
  const scored = (results || []).filter(r => typeof r.seoScore === 'number');
  const total = scored.length;
  const rows = [
    { label: 'Débil (<40)', color: COLOR_DEBIL, n: scored.filter(r => r.seoScore < 40).length },
    { label: 'Mejorable (40–69)', color: COLOR_MEJORABLE, n: scored.filter(r => r.seoScore >= 40 && r.seoScore < 70).length },
    { label: 'Aceptable (70+)', color: COLOR_OK, n: scored.filter(r => r.seoScore >= 70).length },
  ];
  return rows.map(r => ({ ...r, pct: total ? Math.round((r.n / total) * 100) : 0 }));
}

const grande = (s, size) => h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: size, lineHeight: 1.06, letterSpacing: -2, color: '#ffffff' }, s);

function stat(value, label, color) {
  return h('div', {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 292, height: 200,
    borderRadius: 28, backgroundColor: 'rgba(6,8,16,0.55)', border: '2px solid rgba(255,255,255,0.14)',
  }, [
    h('div', { fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 100, lineHeight: 1, color }, String(value)),
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 28, color: 'rgba(255,255,255,0.7)', marginTop: 12 }, label),
  ]);
}

// Una barra: el ancho es proporcional a la cantidad de sitios (con un mínimo visible si hay alguno).
function barra({ label, color, n, pct }, total) {
  const BAR_MAX = INNER - 310;
  const w = n > 0 ? Math.max(18, Math.round((n / Math.max(total, 1)) * BAR_MAX)) : 0;
  return h('div', { display: 'flex', alignItems: 'center', height: 64 }, [
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 28, color: 'rgba(255,255,255,0.8)', width: 310 }, label),
    h('div', { display: 'flex', alignItems: 'center' }, [
      h('div', { width: w, height: 40, borderRadius: 12, backgroundColor: color }, ''),
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 28, color: '#ffffff', marginLeft: 16 }, `${n} · ${pct}%`),
    ]),
  ]);
}

// Árbol de la tarjeta. Se exporta para testearlo sin renderizar.
export function auditCardTree({ rubro, ciudad, radioKm, stats, results }) {
  const dist = distribucion(results);
  const total = stats?.total ?? (results || []).length;
  const scored = dist.reduce((a, r) => a + r.n, 0);
  const titulo = txt(rubro, 60);
  const radio = radioKm ? ` · radio ${radioKm} km` : '';
  const lugar = resumirLugar(ciudad, 64 - radio.length) + radio;

  const header = h('div', { display: 'flex', alignItems: 'center' }, [
    h('div', { display: 'flex', alignItems: 'center', padding: '12px 24px', borderRadius: 999, backgroundColor: 'rgba(6,8,16,0.72)', border: `2px solid ${T.accent}` }, [
      h('div', { width: 14, height: 14, borderRadius: 14, backgroundColor: T.accent, marginRight: 14 }, ''),
      h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 24, letterSpacing: 3, color: '#ffffff' }, 'AUDITORÍA SEO'),
    ]),
  ]);
  const titleBlock = h('div', { display: 'flex', flexDirection: 'column' }, [
    grande(`${total} sitios de ${titulo}`, titulo.length > 28 ? 76 : 88),
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 38, lineHeight: 1.25, color: T.accent, marginTop: 20 }, lugar),
  ]);
  const statsRow = h('div', { display: 'flex', justifyContent: 'space-between' }, [
    stat(total, 'Sitios analizados', '#ffffff'),
    stat(stats?.avgSeoScore ?? '—', 'SEO promedio', T.accent),
    stat(stats?.lowSeoCount ?? 0, 'SEO débil (<50)', COLOR_DEBIL),
  ]);
  const distBlock = h('div', { display: 'flex', flexDirection: 'column' }, [
    h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 24, letterSpacing: 3, color: T.accent, marginBottom: 14 }, 'DISTRIBUCIÓN DEL SEO'),
    ...dist.map(r => barra(r, scored)),
  ]);
  const cta = h('div', { display: 'flex', flexDirection: 'column' }, [
    h('div', { fontFamily: 'Inter', fontWeight: 500, fontSize: 34, color: 'rgba(255,255,255,0.86)' }, 'Mapa y detalle completo en el informe:'),
    h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 40, color: T.accent, marginTop: 8 }, 'marianoaliandri.com.ar/auditorias'),
  ]);
  const footer = h('div', {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '2px solid rgba(255,255,255,0.22)',
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
    }, [header, titleBlock, statsRow, distBlock, cta, footer]),
  ]);
}

// PNG 1080x1350 de la auditoría.
export async function renderAuditCard(data) {
  return renderTree(auditCardTree(data), 'feed');
}
