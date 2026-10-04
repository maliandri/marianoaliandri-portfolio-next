const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

function getKeys() {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  ].filter(Boolean);
  return [...new Set(keys)]; // dedup
}

export function getGeminiKey() {
  const keys = getKeys();
  if (!keys.length) return null;
  const idx = Math.floor(Math.random() * keys.length);
  return keys[idx];
}

export async function callGemini(prompt, { timeout = 25000, model } = {}) {
  const keys = getKeys();
  if (!keys.length) throw new Error('No hay ninguna GEMINI_API_KEY configurada');

  const url = model
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    : GEMINI_URL;

  for (const key of keys) {
    try {
      const resp = await fetch(`${url}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(timeout),
      });

      if (resp.status === 429 || resp.status === 503) continue; // quota agotada o sobrecarga → siguiente key

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || `Gemini error ${resp.status}`);
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (err) {
      if (err.message?.includes('429') || err.name === 'AbortError') continue;
      throw err;
    }
  }

  throw new Error('Todas las Gemini API keys agotaron su cuota (429)');
}
