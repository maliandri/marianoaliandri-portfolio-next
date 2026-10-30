// PDF del presupuesto (mismo contenido que el mail de src/lib/presupuestoEmail.js), armado en el servidor
// con pdf-lib: lo bajan el cliente por el link público (/api/presupuesto/pdf/<id>/?t=<token>), el MCP y
// el mail como adjunto. Helvetica estándar: solo Latin-1 (los acentos y la ñ andan; emojis se sacan).
import { randomBytes } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const SITE_URL = 'https://marianoaliandri.com.ar';
const INDIGO = rgb(0.31, 0.27, 0.9);
const TINTA = rgb(0.07, 0.09, 0.15);
const GRIS = rgb(0.42, 0.45, 0.5);
const GRIS_CLARO = rgb(0.85, 0.86, 0.88);
const VERDE = rgb(0.09, 0.64, 0.29);

const EXTRA = '—–…“”‘’•€';
const limpiar = (s) => String(s ?? '').replace(/\s+/g, ' ').split('').filter(c => (c >= ' ' && c <= '~') || (c >= ' ' && c <= 'ÿ') || EXTRA.includes(c)).join('').trim();
const num = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function partir(texto, font, size, ancho) {
  const lineas = [];
  for (const parrafo of String(texto ?? '').split(/\n+/)) {
    let linea = '';
    for (const palabra of limpiar(parrafo).split(' ').filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(prueba, size) <= ancho) linea = prueba;
      else { if (linea) lineas.push(linea); linea = palabra; }
    }
    if (linea) lineas.push(linea);
  }
  return lineas;
}

// Token del link público: aleatorio y guardado en el doc (no se deduce del id).
export async function tokenPdf(ref, d) {
  if (d.pdfToken) return d.pdfToken;
  const t = randomBytes(18).toString('base64url');
  await ref.update({ pdfToken: t });
  return t;
}

export const pdfUrl = (id, token) => `${SITE_URL}/api/presupuesto/pdf/${encodeURIComponent(id)}/?t=${token}`;
export const pdfNombre = (datos) => `presupuesto-${limpiar(datos.quoteNumber).replace(/[^\w-]+/g, '') || 'mariano-aliandri'}.pdf`;

// `datos` = salida de datosPresupuesto(). Devuelve los bytes del PDF.
export async function generarPdfPresupuesto(datos) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Presupuesto ${limpiar(datos.quoteNumber)}`);
  pdf.setAuthor('Mariano Aliandri');
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 48, ANCHO = W - 2 * M;
  let page = pdf.addPage([W, H]);
  let y = H;

  const texto = (s, x, yy, { size = 10, font = reg, color = TINTA, derecha = false } = {}) => {
    const t = limpiar(s);
    page.drawText(t, { x: derecha ? x - font.widthOfTextAtSize(t, size) : x, y: yy, size, font, color });
  };
  const espacio = (alto) => {
    if (y - alto >= M + 30) return;
    page = pdf.addPage([W, H]);
    y = H - M;
  };

  // Encabezado
  page.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: INDIGO });
  texto('PROPUESTA COMERCIAL', M, H - 44, { size: 8, color: rgb(0.85, 0.85, 1) });
  texto('PRESUPUESTO', M, H - 72, { size: 26, font: bold, color: rgb(1, 1, 1) });
  texto('Mariano Aliandri · Desarrollo Web & Datos', M, H - 94, { size: 10, color: rgb(0.88, 0.88, 1) });
  texto(`N° ${datos.quoteNumber}`, W - M, H - 50, { size: 12, font: bold, color: rgb(1, 1, 1), derecha: true });
  texto(`Fecha: ${datos.today}`, W - M, H - 68, { size: 9, color: rgb(0.88, 0.88, 1), derecha: true });
  texto(`Válido hasta: ${datos.validUntil}`, W - M, H - 82, { size: 9, color: rgb(0.88, 0.88, 1), derecha: true });
  y = H - 150;

  // Cliente
  if (datos.clientName || datos.clientCompany) {
    texto('PARA', M, y, { size: 8, font: bold, color: GRIS });
    y -= 16;
    if (datos.clientName) { texto(datos.clientName, M, y, { size: 13, font: bold }); y -= 15; }
    if (datos.clientCompany) { texto(datos.clientCompany, M, y, { color: GRIS }); y -= 13; }
    if (datos.clientEmail) { texto(datos.clientEmail, M, y, { size: 9, color: GRIS }); y -= 13; }
    y -= 12;
  }

  // Ítems
  const COL_PRECIO = W - M;
  texto('SERVICIO', M, y, { size: 8, font: bold, color: GRIS });
  texto('PRECIO', COL_PRECIO, y, { size: 8, font: bold, color: GRIS, derecha: true });
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: GRIS_CLARO });
  y -= 16;
  datos.items.forEach((it, i) => {
    const desc = partir(it.desc, reg, 9, ANCHO - 140);
    const nombre = partir(`${i + 1}. ${it.label}`, bold, 11, ANCHO - 140);
    espacio(nombre.length * 14 + desc.length * 12 + 20);
    const top = y;
    nombre.forEach(l => { texto(l, M, y, { size: 11, font: bold }); y -= 14; });
    desc.forEach(l => { texto(l, M + 12, y, { size: 9, color: GRIS }); y -= 12; });
    const raw = Number(it.priceUSD) || 0;
    const disc = Number(it.discount) || 0;
    const net = raw * (1 - disc / 100);
    let py = top;
    if (disc > 0) { texto(`USD ${num(raw)} (-${disc}%)`, COL_PRECIO, py, { size: 8, color: GRIS, derecha: true }); py -= 12; }
    if (net > 0) {
      texto(`USD ${num(net)}`, COL_PRECIO, py, { size: 11, font: bold, color: disc > 0 ? VERDE : TINTA, derecha: true });
      if (datos.arsRate) texto(`ARS ${num(net * datos.arsRate)}`, COL_PRECIO, py - 12, { size: 8, color: GRIS, derecha: true });
      py -= 24;
    }
    y = Math.min(y, py) - 8;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: GRIS_CLARO });
    y -= 8;
  });

  // Totales
  const t = datos.totals || {};
  const filas = [];
  if (t.hasDiscount) filas.push(['Subtotal bruto', `USD ${num(t.brutoUSD)}`], ['Bonificaciones', `- USD ${num(t.descUSD)}`]);
  filas.push(['Subtotal (sin IVA)', `USD ${num(t.netoUSD)}`]);
  if (datos.showIVA) filas.push([`IVA (${datos.ivaRate}%)`, `USD ${num(t.ivaUSD)}`]);
  espacio(filas.length * 16 + 60);
  y -= 6;
  for (const [k, v] of filas) {
    texto(k, W - M - 150, y, { size: 10, color: GRIS, derecha: true });
    texto(v, W - M, y, { size: 10, derecha: true });
    y -= 16;
  }
  page.drawLine({ start: { x: W - M - 260, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 1.5, color: TINTA });
  y -= 10;
  texto('TOTAL', W - M - 150, y, { size: 13, font: bold, derecha: true });
  texto(`USD ${num(datos.totalUSD)}`, W - M, y, { size: 15, font: bold, derecha: true });
  y -= 16;
  if (datos.totalARS) { texto(`ARS ${num(datos.totalARS)}`, W - M, y, { size: 10, color: GRIS, derecha: true }); y -= 16; }

  // Plan de pagos
  if (datos.cuotas?.items?.length) {
    espacio(30 + datos.cuotas.items.length * 15);
    y -= 14;
    texto(`Plan de pagos — ${datos.cuotas.numCuotas} cuota${datos.cuotas.numCuotas > 1 ? 's' : ''}`, M, y, { size: 11, font: bold, color: INDIGO });
    y -= 16;
    for (const c of datos.cuotas.items) {
      texto(c.label, M, y);
      texto(`USD ${num(c.usd)}  ·  ARS ${num(c.ars)}`, W - M, y, { derecha: true });
      y -= 15;
    }
  }

  // Link de pago
  if (datos.paymentLink) {
    espacio(50);
    y -= 18;
    texto('Pagá online con MercadoPago:', M, y, { size: 10, font: bold, color: rgb(0, 0.62, 0.89) });
    y -= 14;
    partir(datos.paymentLink, reg, 8, ANCHO).forEach(l => { texto(l, M, y, { size: 8, color: GRIS }); y -= 11; });
  }

  // Notas
  const notas = String(datos.notes || '').trim();
  if (notas) {
    const lineas = partir(notas, reg, 10, ANCHO - 16);
    y -= 16;
    espacio(30);
    texto('NOTAS', M, y, { size: 8, font: bold, color: rgb(0.55, 0.36, 0.96) });
    y -= 15;
    for (const l of lineas) { espacio(14); texto(l, M + 8, y, { color: rgb(0.29, 0.33, 0.39) }); y -= 13; }
  }

  // Pie en todas las páginas
  for (const p of pdf.getPages()) {
    p.drawLine({ start: { x: M, y: 52 }, end: { x: W - M, y: 52 }, thickness: 0.5, color: GRIS_CLARO });
    const pie = 'Mariano Aliandri · Desarrollador Full Stack & Analista de Datos · marianoaliandri.com.ar · +54 299 541-4422';
    p.drawText(pie, { x: (W - reg.widthOfTextAtSize(pie, 8)) / 2, y: 38, size: 8, font: reg, color: GRIS });
    const legal = `Precios en USD sin IVA salvo indicación${datos.arsRate ? ` · Tipo de cambio de referencia: 1 USD = ARS ${num(datos.arsRate)}` : ''}`;
    p.drawText(legal, { x: (W - reg.widthOfTextAtSize(legal, 7)) / 2, y: 26, size: 7, font: reg, color: rgb(0.62, 0.64, 0.68) });
  }

  return pdf.save();
}
