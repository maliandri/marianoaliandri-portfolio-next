// Guiones de reels para grabar CON CARA (los que un bot no puede hacer: antes/después, su panel, "le
// pregunté a mi sistema…"). Salen solos los días elegidos en el admin (/api/cron/guiones/) y a pedido
// (admin → Bot de contenido → Guiones, o Claude por el MCP), armados con datos frescos de las
// auditorías, los informes de demanda y las últimas piezas del bot. Lógica pura, sin I/O.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const FORMATOS = {
  pantalla: 'Pantalla real: muestra su panel, una auditoría o a Claude contestando con datos',
  mito: 'Mito o error común contado a cámara',
  dato: 'Dato local (auditorías o lo que se busca en Google en su zona)',
  tutorial: 'Mini tutorial: un paso concreto que el que mira puede hacer hoy',
  antesDespues: 'Antes y después de un sitio o de un proceso (sin nombres de clientes)',
  pregunta: 'Respuesta a una pregunta que le hacen siempre los clientes',
  detras: 'Detrás de escena: cómo arma un sistema, en qué está trabajando',
};
export const ESTADOS_GUION = ['pendiente', 'grabado', 'publicado', 'descartado'];
export const MAX_GUIONES = 6;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const GUIONES_CONFIG_DEFAULT = { cantidad: 3, dias: [1], mail: true };

// Config del admin (contenido_config/settings.guiones). Devuelve { update } o { error }.
export function validateGuionesConfig(c = {}) {
  const cantidad = Number(c.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_GUIONES) return { error: `cantidad: de 1 a ${MAX_GUIONES}` };
  const dias = [...new Set(Array.isArray(c.dias) ? c.dias.map(Number) : [])].filter(d => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  return { update: { cantidad, dias, mail: c.mail !== false } };
}

export const diasTexto = (dias) => (dias.length ? dias.map(d => DIAS[d]).join(', ') : 'ningún día (solo a pedido)');

// Día de la semana en Argentina (0 = domingo): el cron corre todos los días y decide acá.
export const diaAR = (ms) => new Date(ms - 3 * 3600 * 1000).getUTCDay();

export function buildPromptGuiones({ series = [], auditorias = null, demanda = null, recientes = [], piezas = [], cantidad = 3, tema = '', formato = '' } = {}) {
  const mezcla = formato && FORMATOS[formato]
    ? `Todos con este formato: ${FORMATOS[formato]}.`
    : `Cada uno con un formato distinto, elegido de esta lista según lo que mejor cuente el tema:\n${Object.entries(FORMATOS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
  return `Sos el productor de contenido de Mariano Aliandri, desarrollador de Neuquén (Argentina) que hace sistemas y
sitios a medida y los conecta a Claude (la IA de Anthropic) con un servidor MCP: el dueño del negocio maneja ventas,
presupuestos, stock y redes hablando con Claude. Su propuesta: Next.js, Supabase, dominio sin cuota mensual,
Cloudinary, MercadoPago o Payway, todo conectado a Instagram y Facebook, y un panel propio conectado a Claude.

Escribí ${cantidad} guion${cantidad > 1 ? 'es' : ''} de reels para que Mariano GRABE CON SU CARA y su celular (30 a 45 segundos cada uno).
${tema ? `Tema pedido por Mariano (todos los guiones son sobre esto, con ángulos distintos): ${tema}` : `Series del canal (para inspirarte): ${series.map(s => s.nombre).join(', ')}.`}
${mezcla}
${auditorias ? `Datos reales de sus auditorías de webs de negocios (usalos tal cual, no inventes otros): ${JSON.stringify(auditorias)}` : ''}
${demanda ? `Último informe de qué se busca en Google (${demanda.zona}): ${demanda.top.join(', ')}. Frase real: "${demanda.frase || ''}"` : ''}
${piezas.length ? `Últimas piezas publicadas por el bot de contenido (podés grabar la versión con cara de alguna): ${piezas.join(' | ')}` : ''}
${recientes.length ? `No repitas estos guiones recientes: ${recientes.join(' | ')}` : ''}

Reglas: español rioplatense, de vos, frases cortas para decir en voz alta, nada de frases de IA ("en el mundo de hoy",
"es clave", "no es X, es Y", "descubrí"), nada de precios exactos ni números inventados. El gancho tiene que funcionar
en los primeros 2 segundos y en mute (texto en pantalla). Cada toma: qué dice y qué se ve, filmable con un celular.

Devolvé SOLO un JSON válido, sin markdown:
{ "guiones": [ {
  "titulo": "nombre corto del reel",
  "formato": "una de las claves de la lista",
  "gancho": "lo que dice en los primeros 2 segundos",
  "textoEnPantalla": "texto grande del arranque (máx. 8 palabras)",
  "tomas": [ { "decir": "lo que dice", "mostrar": "qué se ve: cara, pantalla del panel, etc." } ],
  "cierre": "llamado a la acción (mandárselo a alguien con negocio, link en la bio, etc.)",
  "caption": "texto del post, 2 o 3 párrafos cortos, sin hashtags",
  "musica": "qué tipo de música o sonido (ritmo, clima), o 'sin música, solo voz'",
  "edicion": "2 o 3 tips de edición concretos: cortes, zoom, subtítulos, qué resaltar",
  "duracion": "30 s"
} ] }`;
}

const txt = (v, max) => String(v ?? '').trim().slice(0, max);

export function normalizarGuion(g) {
  return {
    titulo: txt(g.titulo, 100), formato: FORMATOS[g.formato] ? g.formato : 'pantalla', gancho: txt(g.gancho, 300),
    textoEnPantalla: txt(g.textoEnPantalla, 80),
    tomas: (Array.isArray(g.tomas) ? g.tomas : []).slice(0, 8)
      .map(t => ({ decir: txt(t?.decir, 400), mostrar: txt(t?.mostrar, 200) })).filter(t => t.decir || t.mostrar),
    cierre: txt(g.cierre, 300), caption: txt(g.caption, 1500), musica: txt(g.musica, 200), edicion: txt(g.edicion, 400),
    duracion: txt(g.duracion || '30 s', 20),
  };
}

export function parseGuiones(raw, { cantidad = 3 } = {}) {
  const t = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let j;
  try {
    j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  } catch {
    throw new Error('La IA no devolvió un JSON válido');
  }
  const guiones = (Array.isArray(j.guiones) ? j.guiones : [])
    .filter(g => g?.titulo && g?.gancho && Array.isArray(g.tomas) && g.tomas.length >= 2)
    .slice(0, cantidad)
    .map(normalizarGuion);
  const minimo = Math.min(2, cantidad);
  if (guiones.length < minimo) throw new Error(`La IA devolvió menos de ${minimo} guion${minimo > 1 ? 'es' : ''} completo${minimo > 1 ? 's' : ''}`);
  return { guiones };
}

export function guionesHtml(guiones, { titulo, adminUrl } = {}) {
  const bloques = guiones.map((g, i) => `
<div style="border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin:0 0 18px">
  <p style="margin:0;color:#6366f1;font-size:12px;font-weight:700;letter-spacing:1px">REEL ${i + 1} · ${esc(g.duracion)}${g.formato ? ` · ${esc(g.formato.toUpperCase())}` : ''}</p>
  <h2 style="margin:4px 0 10px;font-size:18px">${esc(g.titulo)}</h2>
  <p style="margin:0 0 6px"><b>Gancho (primeros 2 s):</b> ${esc(g.gancho)}</p>
  ${g.textoEnPantalla ? `<p style="margin:0 0 10px"><b>Texto en pantalla:</b> ${esc(g.textoEnPantalla)}</p>` : ''}
  <ol style="padding-left:18px;margin:0 0 10px">${g.tomas.map(t => `<li style="margin:0 0 6px"><b>Decí:</b> ${esc(t.decir)}<br><span style="color:#6b7280"><b>Mostrá:</b> ${esc(t.mostrar)}</span></li>`).join('')}</ol>
  <p style="margin:0 0 10px"><b>Cierre:</b> ${esc(g.cierre)}</p>
  ${g.musica ? `<p style="margin:0 0 6px;color:#374151"><b>Música:</b> ${esc(g.musica)}</p>` : ''}
  ${g.edicion ? `<p style="margin:0 0 10px;color:#374151"><b>Edición:</b> ${esc(g.edicion)}</p>` : ''}
  <details><summary style="cursor:pointer;color:#6b7280">Texto del post</summary><p style="white-space:pre-line">${esc(g.caption)}</p></details>
</div>`).join('');
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;max-width:640px">
<h1 style="font-size:20px;margin:0 0 4px">${esc(titulo || `Tus ${guiones.length} reels para grabar`)}</h1>
<p style="color:#6b7280;margin:0 0 18px">Para grabar con el celular. Probá los ganchos nuevos como "reel de prueba" (solo lo ven quienes no te siguen).${adminUrl ? ` Editalos y marcalos como grabados en <a href="${esc(adminUrl)}">el admin</a>.` : ''}</p>
${bloques}
<p style="color:#9ca3af;font-size:12px">Bot de contenido · marianoaliandri.com.ar (src/lib/guiones.js)</p>
</div>`;
}
