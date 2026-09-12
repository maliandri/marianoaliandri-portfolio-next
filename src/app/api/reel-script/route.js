export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { contentType = 'producto', contentName = '', contentDescription = '', items = [] } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

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
      return Response.json({ error: `Gemini error ${res.status}: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const script = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return Response.json({ script });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
