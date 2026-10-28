// Voz en off con el TTS nativo de Gemini (acepta la API key de Gemini, a diferencia de Google Cloud TTS,
// que exige OAuth). Google no tiene voz es-AR: el acento rioplatense se pide en la instrucción de estilo.
// Devuelve un WAV (PCM 16 bits, 24 kHz, mono) y su duración en segundos. Lo usa scripts/reel-prep.mjs.
const MODEL = 'gemini-2.5-flash-preview-tts';
const RATE = 24000;
export const VOZ = 'Charon';
const ESTILO = 'Decilo con acento rioplatense de Argentina, tono cercano, seguro y ágil, como un video corto de Instagram';

export function geminiKeysTts(env = process.env) {
  return [...new Set([env.GEMINI_API_KEY_1, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY].filter(Boolean))];
}

export function pcmToWav(pcm, rate = RATE) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function sintetizar(texto, { keys = geminiKeysTts(), fetchImpl = fetch, intentos = 3, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!keys.length) throw new Error('No hay GEMINI_API_KEY para la voz');
  const errores = [];
  for (let vuelta = 0; vuelta < intentos; vuelta++) {
    for (const key of keys) {
      try {
        const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${ESTILO}: ${texto}` }] }],
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ } } } },
          }),
          signal: AbortSignal.timeout(90000),
        });
        const j = await r.json().catch(() => ({}));
        const data = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (r.ok && data) {
          const pcm = Buffer.from(data, 'base64');
          return { wav: pcmToWav(pcm), segundos: pcm.length / 2 / RATE };
        }
        errores.push(`${r.status} ${j.error?.message?.slice(0, 80) || 'sin audio'}`);
      } catch (e) {
        errores.push(e.name);
      }
    }
    if (vuelta < intentos - 1) await wait(5000 * (vuelta + 1)); // Gemini se satura seguido: esperar y reintentar
  }
  throw new Error(`La voz de Gemini falló: ${errores.slice(-3).join(' · ')}`);
}
