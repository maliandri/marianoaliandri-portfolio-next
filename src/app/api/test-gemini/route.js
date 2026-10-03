export const dynamic = 'force-dynamic';

export async function GET() {
  const keys = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEY_1: process.env.GEMINI_API_KEY_1,
    GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2,
    GEMINI_API_KEY_3: process.env.GEMINI_API_KEY_3,
    GEMINI_API_KEY_4: process.env.GEMINI_API_KEY_4,
    GEMINI_API_KEY_5: process.env.GEMINI_API_KEY_5,
  };

  const results = {};

  for (const [name, key] of Object.entries(keys)) {
    if (!key) { results[name] = '❌ no configurada'; continue; }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'di "ok"' }] }] }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.status === 429) { results[name] = '⚠️ cuota agotada (429)'; continue; }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        results[name] = `❌ error ${res.status}: ${errData?.error?.message || errData?.error?.status || 'sin detalle'}`;
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      results[name] = text ? `✅ ok — "${text}"` : '⚠️ respuesta vacía';
    } catch (e) {
      results[name] = `❌ ${e.message}`;
    }
  }

  return Response.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
