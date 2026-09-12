export const dynamic = 'force-dynamic';

async function callGemini(apiKey, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

    // Modo "caso de éxito": arma un arco narrativo de 4 slides (problema →
    // solución → impacto → CTA) a partir de los datos REALES del proyecto que
    // ya existen en Firestore (descripcionCorta, funcionalidades, impacto), en
    // vez de un slide único con un título genérico. El script del locutor va en
    // primera persona, como si Mariano contara el caso él mismo.
    if (body.mode === 'caso-exito') {
      const { name = '', descripcionCorta = '', funcionalidades = '', impacto = '', stack = '' } = body.proyecto || {};

      const prompt = `Sos Mariano Aliandri, desarrollador full-stack, contando un caso de éxito real para un reel de Instagram.

Proyecto: "${name}"
Qué es / problema que resuelve: ${descripcionCorta || 'sin datos'}
Funcionalidades clave (cómo lo resolví): ${funcionalidades || 'sin datos'}
Stack usado: ${stack || 'sin datos'}
Impacto medido: ${impacto || 'sin datos'}

Generá DOS cosas:

1. "slides": un array de EXACTAMENTE 4 elementos, cada uno con "title" (máx 6 palabras, impactante, texto en pantalla) y "subtitle" (máx 8 palabras, opcional):
   - slide 1: el problema o necesidad concreta del cliente (el gancho)
   - slide 2: cómo lo resolviste — 1 dato técnico o funcionalidad concreta
   - slide 3: el resultado medido — el número o dato de impacto más fuerte, tal cual
   - slide 4: title "¿Necesitás algo así?", subtitle "marianoaliandri.com.ar"

2. "script": narración de locutor en PRIMERA PERSONA (yo/vos), español rioplatense natural y casual, 25-30 segundos hablados (máximo 70 palabras), contando la historia como la contarías vos mismo — no como un folleto. Sin mencionar precios. Sin indicaciones de escena.

Devolvé SOLO JSON, sin markdown: {"slides":[{"title":"...","subtitle":"..."}],"script":"..."}`;

      let raw = await callGemini(apiKey, prompt);
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(raw);
      return Response.json({ slides: parsed.slides || [], script: parsed.script || '' });
    }

    const { contentType = 'producto', contentName = '', contentDescription = '', items = [] } = body;

    // Modo multi-producto: un solo script de locutor que menciona varios items
    // en fila (uno por slide del reel), en vez de describir uno solo a fondo.
    const isMulti = Array.isArray(items) && items.length > 1;
    const contentBlock = isMulti
      ? `Varios ${contentType}s en el mismo reel:\n${items.map((it, i) => `${i + 1}. ${it.name}${it.description ? ` — ${it.description}` : ''}`).join('\n')}`
      : `Contenido: ${contentType} - ${contentName}\nDescripción: ${contentDescription}`;

    const prompt = `Sos un copywriter experto en redes sociales argentinas.
Generá un script de locutor para un reel de Instagram de 25-30 segundos.
${contentBlock}

REGLAS ESTRICTAS:
- Máximo 60 palabras
- Español rioplatense natural (vos, che, etc.)
- No mencionar precios
- Empezar con una pregunta o dato impactante
${isMulti ? '- Mencionar cada item por su nombre, breve, en el orden dado' : ''}
- Cerrar con CTA: visitar marianoaliandri.com.ar
- Solo el texto, sin indicaciones de escena ni acotaciones`;

    const script = await callGemini(apiKey, prompt);
    return Response.json({ script });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
