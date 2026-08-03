// Genera el HTML de un reporte imprimible (Guardar como PDF) de una auditoría SEO.
// Contenido: selección (término + categoría), localidades, texto automático (resumen),
// el mapa/plano capturado como imagen, la tabla de sitios scrapeados y el pie de página.
// Uso: buildAuditReportHtml({ title, term, categoryLabels, cities, summary, stats, results, mapImage, publishedAt })

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreBadge(s) {
  if (s == null) return '<span style="color:#9ca3af">—</span>';
  const color = s >= 70 ? '#16a34a' : s >= 40 ? '#d97706' : '#dc2626';
  const bg    = s >= 70 ? '#dcfce7' : s >= 40 ? '#fef3c7' : '#fee2e2';
  return `<span style="display:inline-block;min-width:26px;text-align:center;font-weight:700;font-size:11px;color:${color};background:${bg};border-radius:999px;padding:2px 6px">${s}</span>`;
}

function check(v) {
  if (v === null || v === undefined) return '<span style="color:#cbd5e1">—</span>';
  return v ? '<span style="color:#16a34a">✓</span>' : '<span style="color:#dc2626">✗</span>';
}

function shortUrl(url) {
  if (!url) return '';
  return esc(url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 48));
}

export function buildAuditReportHtml({
  title = 'Auditoría SEO',
  term = '',
  categoryLabels = [],
  cities = [],
  summary = '',
  stats = {},
  results = [],
  mapImage = null,
  publishedAt = null,
} = {}) {
  const fecha = publishedAt
    ? new Date(publishedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  const categoria = (categoryLabels || []).filter(Boolean).join(', ');
  const localidades = (cities || []).filter(Boolean).join(', ');

  // Texto automático: usa el resumen (Gemini) si existe; si no, uno genérico.
  const textoAuto = summary
    ? esc(summary)
    : `Este reporte analiza la presencia digital de los negocios encontrados${term ? ` para la búsqueda "${esc(term)}"` : ''}${localidades ? ` en ${esc(localidades)}` : ''}. Para cada sitio se evaluó el Score SEO (sitemap, robots.txt, meta description, Open Graph y antigüedad), identificando oportunidades de mejora.`;

  const filas = results.map((r, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td class="neg">${esc(r.nombre || '—')}</td>
      <td class="ciu">${esc(r.ciudad || '—')}</td>
      <td class="url">${shortUrl(r.siteUrl)}</td>
      <td class="c">${scoreBadge(r.seoScore)}</td>
      <td class="c">${check(r.hasSitemap)}</td>
      <td class="c">${check(r.hasRobots)}</td>
      <td class="c">${check(r.metaDesc != null ? !!r.metaDesc : null)}</td>
      <td class="c">${check(r.hasOG)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(title)} — Reporte SEO</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; font-size: 12.5px; line-height: 1.5; }
  .page { max-width: 820px; margin: 0 auto; padding: 28px 32px; }
  .brand { font-size: 11px; font-weight: 700; color: #4f46e5; letter-spacing: .08em; text-transform: uppercase; }
  h1 { font-size: 24px; margin: 6px 0 2px; color: #111827; }
  .date { color: #9ca3af; font-size: 12px; margin: 0 0 14px; }
  .sel { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0; }
  .sel .item { flex: 1; min-width: 150px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 9px 12px; }
  .sel .label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; }
  .sel .value { font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px; }
  .stats { display: flex; gap: 8px; margin: 12px 0; }
  .stats .s { flex: 1; text-align: center; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; }
  .stats .n { font-size: 20px; font-weight: 800; color: #111827; }
  .stats .l { font-size: 10px; color: #9ca3af; }
  p.auto { margin: 6px 0 14px; }
  h2 { font-size: 15px; color: #111827; margin: 20px 0 8px; }
  .map { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
  .map img { width: 100%; display: block; }
  .nomap { background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 10px; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .03em; color: #9ca3af; border-bottom: 2px solid #e5e7eb; padding: 5px 6px; }
  th.c, td.c { text-align: center; }
  td { padding: 6px; border-bottom: 1px solid #f1f1f4; font-size: 11px; vertical-align: middle; }
  td.num { color: #9ca3af; width: 22px; }
  td.neg { font-weight: 600; color: #111827; max-width: 180px; }
  td.ciu { color: #6b7280; }
  td.url { color: #4f46e5; max-width: 190px; word-break: break-all; }
  .footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
  .footer strong { color: #4f46e5; }
  @media print {
    .page { padding: 0; }
    tr { break-inside: avoid; }
    h2 { break-after: avoid; }
    .map { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="brand">Mariano Aliandri · Auditoría Web & SEO Local</div>
  <h1>${esc(title)}</h1>
  <p class="date">${fecha} · marianoaliandri.com.ar</p>

  <div class="sel">
    <div class="item"><div class="label">Término buscado</div><div class="value">${esc(term) || '—'}</div></div>
    <div class="item"><div class="label">Categoría</div><div class="value">${esc(categoria) || '—'}</div></div>
    <div class="item"><div class="label">Localidades</div><div class="value">${esc(localidades) || '—'}</div></div>
  </div>

  <div class="stats">
    <div class="s"><div class="n">${stats.total ?? results.length}</div><div class="l">Sitios analizados</div></div>
    <div class="s"><div class="n">${stats.withEmail ?? '—'}</div><div class="l">Con email</div></div>
    <div class="s"><div class="n">${stats.lowSeoCount ?? '—'}</div><div class="l">SEO débil</div></div>
    <div class="s"><div class="n">${stats.avgSeoScore ?? '—'}</div><div class="l">Score promedio</div></div>
  </div>

  <p class="auto">${textoAuto}</p>

  <h2>Mapa de los negocios</h2>
  ${mapImage
    ? `<div class="map"><img src="${mapImage}" alt="Mapa de negocios"></div>`
    : `<div class="nomap">Mapa no disponible para esta auditoría.</div>`}

  <h2>Sitios analizados</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Negocio</th><th>Ciudad</th><th>Sitio web</th>
        <th class="c">Score</th><th class="c">Sitemap</th><th class="c">Robots</th><th class="c">Meta</th><th class="c">OG</th>
      </tr>
    </thead>
    <tbody>
      ${filas || '<tr><td colspan="9">Sin resultados</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Reporte generado por <strong>Mariano Aliandri</strong> · marianoaliandri.com.ar
  </div>

</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };</script>
</body>
</html>`;
}
