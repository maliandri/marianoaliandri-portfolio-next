// Guiones semanales para los reels CON CARA de Mariano (los que un bot no puede hacer: antes/después,
// su panel, "le pregunté a mi sistema…"). Cada lunes llegan 3 por mail (/api/cron/guiones/), armados con
// los datos frescos de las auditorías y de los informes de demanda. Lógica pura, sin I/O.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildPromptGuiones({ series = [], auditorias = null, demanda = null, recientes = [] } = {}) {
  return `Sos el productor de contenido de Mariano Aliandri, desarrollador de Neuquén (Argentina) que hace sistemas y
sitios a medida y los conecta a Claude (la IA de Anthropic) con un servidor MCP: el dueño del negocio maneja ventas,
presupuestos, stock y redes hablando con Claude. Su propuesta: Next.js, Supabase, dominio sin cuota mensual,
Cloudinary, MercadoPago o Payway, todo conectado a Instagram y Facebook, y un panel propio conectado a Claude.

Escribí 3 guiones de reels para que Mariano GRABE CON SU CARA y su celular esta semana (30 a 45 segundos cada uno).
Tienen que ser distintos entre sí. Mezclá: uno mostrando su pantalla real (su panel, una auditoría, Claude
contestando con datos), uno de opinión o mito contado a cámara, y uno con un dato local de los que te paso.
Series del canal (para inspirarte): ${series.map(s => s.nombre).join(', ')}.
${auditorias ? `Datos reales de sus auditorías de webs de negocios (usalos tal cual, no inventes otros): ${JSON.stringify(auditorias)}` : ''}
${demanda ? `Último informe de qué se busca en Google (${demanda.zona}): ${demanda.top.join(', ')}. Frase real: "${demanda.frase || ''}"` : ''}
${recientes.length ? `No repitas estos temas de las últimas semanas: ${recientes.join(' | ')}` : ''}

Reglas: español rioplatense, de vos, frases cortas para decir en voz alta, nada de frases de IA ("en el mundo de hoy",
"es clave", "no es X, es Y", "descubrí"), nada de precios exactos ni números inventados. El gancho tiene que funcionar
en los primeros 2 segundos y en mute (texto en pantalla).

Devolvé SOLO un JSON válido, sin markdown:
{ "guiones": [ {
  "titulo": "nombre corto del reel",
  "gancho": "lo que dice en los primeros 2 segundos",
  "textoEnPantalla": "texto grande del arranque (máx. 8 palabras)",
  "tomas": [ { "decir": "lo que dice", "mostrar": "qué se ve: cara, pantalla del panel, etc." } ],
  "cierre": "llamado a la acción (mandárselo a alguien con negocio, link en la bio, etc.)",
  "caption": "texto del post, 2 o 3 párrafos cortos, sin hashtags",
  "duracion": "30 s"
} ] }`;
}

export function parseGuiones(raw) {
  const txt = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let j;
  try {
    j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  } catch {
    throw new Error('La IA no devolvió un JSON válido');
  }
  const guiones = (Array.isArray(j.guiones) ? j.guiones : [])
    .filter(g => g?.titulo && g?.gancho && Array.isArray(g.tomas) && g.tomas.length >= 2)
    .slice(0, 3)
    .map(g => ({
      titulo: String(g.titulo).slice(0, 100), gancho: String(g.gancho).slice(0, 300),
      textoEnPantalla: String(g.textoEnPantalla || '').slice(0, 80),
      tomas: g.tomas.slice(0, 8).map(t => ({ decir: String(t?.decir || '').slice(0, 400), mostrar: String(t?.mostrar || '').slice(0, 200) })),
      cierre: String(g.cierre || '').slice(0, 300), caption: String(g.caption || '').slice(0, 1500), duracion: String(g.duracion || '30 s').slice(0, 20),
    }));
  if (guiones.length < 2) throw new Error('La IA devolvió menos de 2 guiones completos');
  return { guiones };
}

export function guionesHtml(guiones, { semana } = {}) {
  const bloques = guiones.map((g, i) => `
<div style="border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin:0 0 18px">
  <p style="margin:0;color:#6366f1;font-size:12px;font-weight:700;letter-spacing:1px">REEL ${i + 1} · ${esc(g.duracion)}</p>
  <h2 style="margin:4px 0 10px;font-size:18px">${esc(g.titulo)}</h2>
  <p style="margin:0 0 6px"><b>Gancho (primeros 2 s):</b> ${esc(g.gancho)}</p>
  ${g.textoEnPantalla ? `<p style="margin:0 0 10px"><b>Texto en pantalla:</b> ${esc(g.textoEnPantalla)}</p>` : ''}
  <ol style="padding-left:18px;margin:0 0 10px">${g.tomas.map(t => `<li style="margin:0 0 6px"><b>Decí:</b> ${esc(t.decir)}<br><span style="color:#6b7280"><b>Mostrá:</b> ${esc(t.mostrar)}</span></li>`).join('')}</ol>
  <p style="margin:0 0 10px"><b>Cierre:</b> ${esc(g.cierre)}</p>
  <details><summary style="cursor:pointer;color:#6b7280">Texto del post</summary><p style="white-space:pre-line">${esc(g.caption)}</p></details>
</div>`).join('');
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;max-width:640px">
<h1 style="font-size:20px;margin:0 0 4px">Tus 3 reels de la semana${semana ? ` (${esc(semana)})` : ''}</h1>
<p style="color:#6b7280;margin:0 0 18px">Para grabar con el celular. Probá los ganchos nuevos como "reel de prueba" (solo lo ven quienes no te siguen).</p>
${bloques}
<p style="color:#9ca3af;font-size:12px">Bot de contenido · marianoaliandri.com.ar (src/lib/guiones.js)</p>
</div>`;
}
