// Parseo de los textos libres del catálogo de WhatsApp de un proveedor (Mood Fit):
// talles ("TALLE XS AL XL", "Talles 1 al 4", "BORDO TALLE 1 AL 3 GRIS TALLE 2 Y 3") y
// precios ("$21.300 por mayor", "$35.300 por menor"). Funciones puras, usadas por
// scripts/proveedor-sync.mjs.

const LETRAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

function normLetra(t) {
  const u = t.toUpperCase();
  if (u === 'XXL') return '2XL';
  if (u === 'XXXL') return '3XL';
  if (/^X{4}L$/.test(u)) return '4XL';
  return u;
}

const TOKEN = '(\\d{1,2}|X{0,4}S|M|X{0,4}L|\\d\\s?XL)';

function rango(a, b) {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const x = Number(a), y = Number(b);
    if (y < x || y - x > 20) return [];
    // Talles de pantalón (24 al 30, 36 al 48) van de a 2.
    const paso = x >= 20 && (y - x) % 2 === 0 ? 2 : 1;
    const out = [];
    for (let i = x; i <= y; i += paso) out.push(String(i));
    return out;
  }
  const i = LETRAS.indexOf(normLetra(a.replace(/\s/g, '')));
  const j = LETRAS.indexOf(normLetra(b.replace(/\s/g, '')));
  if (i < 0 || j < 0 || j < i) return [];
  return LETRAS.slice(i, j + 1);
}

function ordenar(talles) {
  return [...talles].sort((a, b) => {
    const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
    if (na && nb) return Number(a) - Number(b);
    if (na !== nb) return na ? -1 : 1;
    return LETRAS.indexOf(a) - LETRAS.indexOf(b);
  });
}

// Devuelve la lista de talles (sin repetidos, ordenada) o [] si no entiende el texto.
export function parseTalles(texto) {
  if (!texto) return [];
  const t = texto.replace(/\$\s?[\d.,]+/g, ' ');
  const set = new Set();
  const reRango = new RegExp(`\\b${TOKEN}\\s*(?:AL|A|-)\\s*${TOKEN}\\b`, 'gi');
  for (const m of t.matchAll(reRango)) rango(m[1], m[2]).forEach((x) => set.add(x));
  // "TALLE 2 Y 3", "TALLE 1 Y 3"
  const reY = new RegExp(`TALLES?\\s+${TOKEN}\\s+Y\\s+${TOKEN}\\b`, 'gi');
  for (const m of t.matchAll(reY)) [m[1], m[2]].forEach((x) => set.add(/^\d+$/.test(x) ? x : normLetra(x)));
  // "MARRON 1 Y 3" (sin la palabra talle, después de un rango)
  if (set.size) {
    for (const m of t.matchAll(/\b(\d{1,2})\s+Y\s+(\d{1,2})\b/g)) { set.add(m[1]); set.add(m[2]); }
  }
  // Talle único: "Talle 1", "TALLE ESPECIAL", "TALLE UNICO"
  if (!set.size) {
    const m = t.match(/TALLES?\s*:?\s*(UNICO|ÚNICO|ESPECIAL|\d{1,2}|X{0,4}S|M|X{0,4}L|\dXL)\b/i);
    if (m) set.add(/^\d+$/.test(m[1]) ? m[1] : normLetra(m[1]).replace('ÚNICO', 'UNICO'));
  }
  return ordenar(set);
}

function aNumero(s) {
  // "$21.300" → 21300 ; "$15.274,81" → 15274.81 ; "$ 7.575" → 7575
  const limpio = s.replace(/[^\d.,]/g, '');
  const conDecimales = /,\d{1,2}$/.test(limpio);
  const n = Number(conDecimales ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/[.,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Precio "por menor" escrito en la descripción → precio sugerido de venta.
export function parsePrecioMenor(texto) {
  if (!texto) return null;
  const m = texto.match(/\$\s?([\d.,]+)\s*(?:por|x)\s*menor/i);
  return m ? aNumero(m[1]) : null;
}

// "ARS 21,300.00" (formato del campo precio de WhatsApp) → 21300
export function parsePrecioArs(texto) {
  if (!texto) return null;
  const m = texto.match(/ARS\s?([\d.,]+)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Código del producto = primera palabra del título si tiene dígitos ("MLL1054", "2007", "0038").
export function parseCodigo(titulo) {
  const limpio = limpiarTitulo(titulo);
  const primera = limpio.split(/\s+/)[0] || '';
  return /\d/.test(primera) && primera.length <= 14 ? primera.toUpperCase() : null;
}

// Saca emojis y símbolos del principio del título.
export function limpiarTitulo(titulo) {
  return (titulo || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
}
