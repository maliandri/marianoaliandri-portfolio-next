// Bot de contenido (reemplaza al bot de noticias): lógica pura, sin I/O. La corrida está en
// src/lib/contenidoRun.js. Cada pieza = carrusel (Facebook + Instagram), PDF (LinkedIn) y una
// página propia en /aprende/<id> que lleva al resto del sitio (nada de mandar tráfico afuera).

const SITE_URL = 'https://marianoaliandri.com.ar';
export const MIN_SLIDES = 4;
export const MAX_SLIDES = 6;
const LIMITES = { titulo: 90, slideTitulo: 70, slideTexto: 200, caption: 1500, parrafo: 900 };

// La serie activa que hace más tiempo que no sale (las que nunca salieron, primero).
export function pickSerie(series, ultimaCorrida = {}) {
  const activas = (series || []).filter(s => s.activo !== false);
  if (!activas.length) return null;
  return [...activas].sort((a, b) => (ultimaCorrida[a.id] || 0) - (ultimaCorrida[b.id] || 0) || (a.orden ?? 0) - (b.orden ?? 0))[0];
}

// Números agregados de las últimas auditorías (para la serie "El error que más veo"). Sin nombres.
// Un mismo sitio aparece en varias auditorías (pasó: "575 webs" contaba repetidos): se cuenta una vez por
// dominio. La ciudad viene como "Neuquén" o "Neuquén, Neuquén": se queda la primera parte.
const dominio = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
const ciudadCorta = (c) => String(c || '').split(',')[0].trim();

export function statsAuditorias(auditorias) {
  const vistos = new Set();
  const filas = auditorias
    .flatMap(a => (a.results || []).map(r => ({ ...r, rubro: a.config?.tiposLabels?.[0] || r.tipo, ciudad: ciudadCorta(r.ciudad || a.config?.ciudades?.[0]) })))
    .filter(r => {
      const k = dominio(r.siteUrl);
      if (!k) return true; // sin web no hay con qué deduplicar
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  const conScore = filas.filter(r => typeof r.seoScore === 'number');
  if (conScore.length < 5) return null;
  const pct = (pred) => {
    const base = filas.filter(r => pred(r) !== null);
    return base.length ? Math.round((base.filter(r => pred(r) === true).length / base.length) * 100) : null;
  };
  return {
    sitiosAuditados: filas.length,
    cantidadCiudades: new Set(filas.map(r => r.ciudad.toLowerCase()).filter(Boolean)).size,
    ciudades: [...new Map(filas.filter(r => r.ciudad).map(r => [r.ciudad.toLowerCase(), r.ciudad])).values()].slice(0, 8),
    rubros: [...new Set(filas.map(r => r.rubro).filter(Boolean))].slice(0, 8),
    puntajeSeoPromedio: Math.round(conScore.reduce((s, r) => s + r.seoScore, 0) / conScore.length),
    pctPuntajeBajo50: pct(r => (typeof r.seoScore === 'number' ? r.seoScore < 50 : null)),
    pctSinDescripcionEnGoogle: pct(r => (r.metaDesc == null ? null : !r.metaDesc)),
    pctSinSitemap: pct(r => (r.hasSitemap == null ? null : !r.hasSitemap)),
    pctSinFotoAlCompartir: pct(r => (r.hasOG == null ? null : !r.hasOG)),
    pctSinRobots: pct(r => (r.hasRobots == null ? null : !r.hasRobots)),
  };
}

export function buildPrompt(serie, { recientes = [], datos = null } = {}) {
  return `Sos Mariano Aliandri, desarrollador de Neuquén (Argentina) que hace sistemas y sitios a medida para negocios
y los conecta a Claude (la IA de Anthropic) con un servidor MCP, para que el dueño maneje su negocio hablando con
Claude. Tu propuesta: sitio en Next.js, base de datos en Supabase, dominio propio sin cuota mensual, imágenes en
Cloudinary para que el sitio vuele, cobros con MercadoPago o Payway, todo conectado a Instagram y Facebook, y un
panel propio conectado a Claude.

Escribí UNA pieza de la serie "${serie.nombre}" para Instagram, Facebook y LinkedIn.
Qué tiene que hacer la pieza: ${serie.angulo}
Ejemplo de gancho de esta serie (no lo copies tal cual): "${serie.gancho}"
${recientes.length ? `Ya publicaste estos títulos en la serie, NO repitas el mismo tema ni ángulo:\n${recientes.map(t => `- ${t}`).join('\n')}` : ''}
${datos ? `Datos reales que podés usar (no inventes otros números):\n${JSON.stringify(datos)}` : 'No inventes números ni estadísticas: si no tenés un dato real, no pongas cifras.'}

Reglas de escritura:
- Español rioplatense, de vos, claro y concreto, para un dueño de negocio que no es técnico.
- Nada de frases de IA: no "en el mundo de hoy", no "es clave", no "no es magia", no "imaginá", no "súper", no "sin demoras y sin errores", no "no es X, es Y", no listas de "sin X, sin Y, sin Z", no "descubrí", no exclamaciones en cadena.
- Si usás un término técnico (MCP, base de datos, dominio), explicalo en la misma frase.
- Nada de promesas imposibles ni de precios exactos.

Devolvé SOLO un JSON válido, sin markdown, con esta forma:
{
  "titulo": "gancho de la portada, máximo ${LIMITES.titulo} caracteres",
  "slides": [ { "titulo": "máximo ${LIMITES.slideTitulo} caracteres", "texto": "máximo ${LIMITES.slideTexto} caracteres" } ],
  "caption": "texto del post para redes, 2 a 4 párrafos cortos, máximo ${LIMITES.caption} caracteres, sin hashtags ni links",
  "cuerpo": ["3 a 6 párrafos para la página del sitio, que desarrollen el tema completo"],
  "hashtags": ["máximo 4, sin #, en CamelCase"]
}
Entre ${MIN_SLIDES} y ${MAX_SLIDES} slides. La última slide NO es de cierre (el cierre lo agrego yo).`;
}

const corto = (s, max) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

// Valida y normaliza la respuesta de la IA. Tira si no sirve (la corrida reintenta una vez).
export function parseContenido(raw) {
  const txt = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let j;
  try {
    j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  } catch {
    throw new Error('La IA no devolvió un JSON válido');
  }
  const slides = (Array.isArray(j.slides) ? j.slides : [])
    .map(s => ({ titulo: corto(s?.titulo, LIMITES.slideTitulo), texto: corto(s?.texto, LIMITES.slideTexto) }))
    .filter(s => s.titulo && s.texto);
  const cuerpo = (Array.isArray(j.cuerpo) ? j.cuerpo : []).map(p => String(p || '').trim()).filter(p => p.length > 40).slice(0, 6);
  if (!j.titulo || slides.length < MIN_SLIDES || !j.caption || cuerpo.length < 2) {
    throw new Error('La respuesta de la IA vino incompleta (título, slides, caption o cuerpo)');
  }
  return {
    titulo: corto(j.titulo, LIMITES.titulo),
    slides: slides.slice(0, MAX_SLIDES),
    caption: String(j.caption).trim().slice(0, LIMITES.caption),
    cuerpo: cuerpo.map(p => p.slice(0, LIMITES.parrafo)),
    hashtags: (Array.isArray(j.hashtags) ? j.hashtags : [])
      .map(h => String(h).replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).slice(0, 4),
  };
}

export const contenidoUrl = (id) => `${SITE_URL}/aprende/${id}/`;

// Texto final del post: el caption de la IA + pedido de mandarlo por DM (lo que más pesa para que
// Instagram lo muestre a gente nueva) + link a la página propia + hashtags.
export function buildCaption(c, id) {
  return [
    c.caption,
    '',
    '📲 Mandáselo a alguien que tenga un negocio.',
    '',
    `Más en: ${contenidoUrl(id)}`,
    '',
    ['#NegociosLocales', ...c.hashtags.map(h => `#${h}`)].slice(0, 5).join(' '),
  ].join('\n');
}

// PATCH del admin sobre la config y las series. Devuelve { update } o { error }.
export function validateContenidoPatch(body) {
  const update = {};
  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') return { error: 'activo debe ser boolean' };
    update.activo = body.activo;
  }
  if ('series' in body) {
    if (!Array.isArray(body.series) || !body.series.length || body.series.length > 40) return { error: 'series: entre 1 y 40' };
    const series = [];
    for (const [i, s] of body.series.entries()) {
      const id = String(s?.id || '').trim();
      const nombre = String(s?.nombre || '').trim().slice(0, 80);
      const angulo = String(s?.angulo || '').trim().slice(0, 1500);
      const ctaPath = String(s?.cta?.path || '').trim();
      if (!/^[a-z0-9-]{2,60}$/.test(id) || !nombre || angulo.length < 20) return { error: `Serie ${i + 1}: falta id, nombre o ángulo` };
      if (!/^\/[a-z0-9/_-]*$/i.test(ctaPath)) return { error: `${nombre}: el link tiene que ser una ruta del sitio (ej. /presupuesto/)` };
      if (series.some(x => x.id === id)) return { error: `Serie repetida: ${id}` };
      series.push({
        id, nombre, angulo, activo: s.activo !== false, orden: i,
        gancho: String(s?.gancho || '').trim().slice(0, 150),
        cta: { label: String(s?.cta?.label || 'Ver más').trim().slice(0, 40), path: ctaPath },
        ...(s?.dato === 'auditorias' ? { dato: 'auditorias' } : {}),
      });
    }
    update.series = series;
  }
  if (!Object.keys(update).length) return { error: 'Nada para actualizar' };
  return { update };
}
