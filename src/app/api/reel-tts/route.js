export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { script } = await request.json();
    if (!script) return Response.json({ error: 'script requerido' }, { status: 400 });

    const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return Response.json({ error: 'GOOGLE_TTS_API_KEY no configurada' }, { status: 500 });

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: script },
          voice: { languageCode: 'es-AR', name: 'es-AR-Standard-B' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: 0.0 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `TTS error ${res.status}: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const audioBase64 = data.audioContent;

    // Estimar duración: ~150 palabras/minuto a speakingRate 0.95
    const words = script.trim().split(/\s+/).length;
    const duration = Math.ceil((words / 150) * 60 / 0.95);

    return Response.json({ audioBase64, duration });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
