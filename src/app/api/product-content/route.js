export const dynamic = 'force-dynamic';

// Genera contenido enriquecido de un producto de la tienda a partir de su
// descripción base, usando Gemini 2.5 Flash. Devuelve JSON estructurado.
export async function POST(request) {
  try {
    const { name = '', description = '', category = '' } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

    const prompt = `Sos un consultor de desarrollo de software y copywriter. A partir de un servicio de una tienda de desarrollo web / data, generá contenido de venta claro y realista.

Servicio: ${name}
Categoría: ${category || 'desarrollo'}
Descripción base: ${description}

Devolvé EXCLUSIVAMENTE un JSON válido (sin markdown, sin backticks) con esta forma:
{
  "descripcion": "descripción de marketing de 2-3 oraciones, español rioplatense profesional, orientada a conversión, sin inventar precios",
  "ideaDesarrollo": "1-2 oraciones sobre CÓMO se construye técnicamente (stack, integraciones, enfoque). Ej: 'Se desarrolla con Next.js y Firestore, integra pasarela de pago MercadoPago y panel de administración.'",
  "features": ["4 a 6 bullets cortos de características/beneficios"],
  "deliverables": ["3 a 5 entregables concretos"],
  "tags": ["3 a 5 etiquetas de una o dos palabras para filtros"]
}

Reglas: JSON válido y parseable, comillas dobles, sin comentarios, sin texto fuera del JSON.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Gemini error ${res.status}: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback: extraer el primer bloque {...}
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return Response.json({ error: 'Respuesta IA no parseable', raw }, { status: 502 });
      parsed = JSON.parse(m[0]);
    }

    const arr = (v) => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    return Response.json({
      content: {
        descripcion: String(parsed.descripcion || '').trim(),
        ideaDesarrollo: String(parsed.ideaDesarrollo || '').trim(),
        features: arr(parsed.features),
        deliverables: arr(parsed.deliverables),
        tags: arr(parsed.tags),
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
