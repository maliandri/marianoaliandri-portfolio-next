export const dynamic = 'force-dynamic';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await resp.json();
  if (!resp.ok || data?.error) {
    throw new Error(`Gemini ${resp.status}: ${data?.error?.message || 'error desconocido'}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini no generó texto (posible bloqueo de contenido)');
  return text;
}

// Fallback escrito a mano si Gemini no está disponible.
function buildTemplateDM({ nombre, ciudad, hasWebsite, nivelSeo }) {
  if (!hasWebsite) {
    return `Hola! Soy Mariano, desarrollador web${ciudad ? ` acá en ${ciudad}` : ''} 👋 Vi que ${nombre} todavía no tiene sitio propio — eso hace que en Google te encuentren mucho menos que a la competencia. Te armo uno simple y rápido si te interesa, sin compromiso. ¿Charlamos?`;
  }
  return `Hola! Soy Mariano, desarrollador web${ciudad ? ` de ${ciudad}` : ''} 👋 Estuve revisando la web de ${nombre} y noté que tiene un SEO ${nivelSeo} — eso significa que Google no te está mostrando todo lo que podría. Puedo mostrarte gratis qué le falta, ¿te interesa?`;
}

// POST — genera (no envía) un texto corto tipo DM de Instagram para contactar en frío a un
// negocio auditado. El envío es siempre manual (Instagram no tiene API de DM en frío), esto
// solo ahorra la redacción. Mismos datos que /api/auditorias/send-biz-email, formato distinto.
export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, siteUrl, seoScore, hasSitemap, hasRobots, metaDesc, hasOG, ciudad, tipo } = body;
    if (!nombre) return Response.json({ error: 'nombre requerido' }, { status: 400 });

    const hasWebsite = !!siteUrl;
    const nivelSeo = seoScore >= 70 ? 'bueno' : seoScore >= 40 ? 'mejorable' : 'débil';
    const problemas = [];
    if (!hasSitemap) problemas.push('no tiene sitemap.xml');
    if (!hasRobots)  problemas.push('no tiene robots.txt');
    if (!metaDesc)   problemas.push('le faltan meta descriptions');
    if (!hasOG)      problemas.push('no tiene Open Graph (se ve mal al compartir en redes)');

    let dmText, source;
    try {
      const prompt = `Sos Mariano Aliandri, desarrollador web independiente${ciudad ? ` de ${ciudad}` : ''}.
Escribí un mensaje directo de Instagram (DM) en frío para el negocio "${nombre}"${ciudad ? ` de ${ciudad}` : ''}, rubro ${tipo || 'comercio'}.

${hasWebsite
  ? `Tiene sitio web (${siteUrl}) con Score SEO ${seoScore ?? '—'}/100 (nivel ${nivelSeo}).${problemas.length ? ` Problemas: ${problemas.join(', ')}.` : ''}`
  : 'NO tiene sitio web propio (oportunidad clara: negocio sin presencia digital).'}

El mensaje debe:
- Ser MUY corto: 3-4 líneas máximo, como se escribe un DM real, no un email.
- Ir directo: quién sos, qué notaste puntualmente de este negocio, y una pregunta simple para abrir charla.
- Tono cercano y casual, español rioplatense (vos), como si le escribieras a un conocido — nunca corporativo, nunca "estimados", nunca suena a plantilla masiva.
- Sin firma al final, sin "saludos", termina con la pregunta.
- Puede usar como máximo 1 emoji, y no es obligatorio.
- NO uses guiones ni bullets, es un mensaje de chat, todo corrido.

Devolvé SOLO el texto del mensaje, nada más.`;
      dmText = await callGemini(prompt);
      source = 'gemini';
    } catch (e) {
      console.warn('[generate-dm] Gemini no disponible, usando plantilla:', e.message);
      dmText = buildTemplateDM({ nombre, ciudad, hasWebsite, nivelSeo });
      source = 'template';
    }

    return Response.json({ success: true, dmText, source });
  } catch (e) {
    console.error('[generate-dm] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
