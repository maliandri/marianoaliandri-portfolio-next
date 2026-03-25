export const dynamic = 'force-dynamic';

const MAKE_WEBHOOK = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

export async function POST(request) {
  try {
    const { videoUrl, productId = 'reel', text, subtitle, aiProvider = 'gemini', useAI = true, type = 'reel' } = await request.json();

    if (!videoUrl) {
      return Response.json({ error: 'No videoUrl provided' }, { status: 400 });
    }

    // Notificar Make.com con payload completo para que Gemini escriba el post
    try {
      const makeRes = await fetch(`${MAKE_WEBHOOK}?productId=${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:         videoUrl,
          type,
          aiProvider,
          useAI,
          text,
          // estructura metadata compatible con el payload viejo de Shotstack
          metadata: {
            videoUrl,
            title:       text,
            productId,
            productName: text,
            format:      'reel',
            currency:    'USD',
          },
        }),
      });
      if (!makeRes.ok) {
        const makeErr = await makeRes.text();
        console.error('[upload-reel] Make.com error:', makeRes.status, makeErr);
      }
    } catch (makeError) {
      console.error('[upload-reel] Make.com fetch failed:', makeError.message);
    }

    return Response.json({ success: true, videoUrl });
  } catch (error) {
    return Response.json({ error: 'Internal error', message: error.message }, { status: 500 });
  }
}
