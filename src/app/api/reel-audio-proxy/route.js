export const dynamic = 'force-dynamic';

// Proxy server-side para URLs de audio externas (Jamendo, etc.) que no tienen
// CORS headers. El browser no puede fetchear esas URLs directamente para Web Audio,
// pero el server sí. El cliente llama a este endpoint en vez de la URL original.
// Se fuerza mp31 (96kbps) para Jamendo — suficiente para un reel de 15-30s y
// bien por debajo del límite de 4.5MB de Vercel (típico: ~2MB para 3 minutos).

const ALLOWED_HOSTS = [
  'mp3l.jamendo.com',
  'storage.jamendo.com',
  'prod-1.storage.jamendo.com',
  'prod-2.storage.jamendo.com',
  'res.cloudinary.com',
];

function isAllowed(urlStr) {
  try {
    const { hostname } = new URL(urlStr);
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

function toMp31(urlStr) {
  // Jamendo: baja a 96kbps para no superar los 4.5MB de Vercel
  return urlStr.replace(/format=mp32/g, 'format=mp31');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return Response.json({ error: 'Falta parámetro url' }, { status: 400 });
  }

  if (!rawUrl.startsWith('https://')) {
    return Response.json({ error: 'Solo se permiten URLs HTTPS' }, { status: 400 });
  }

  if (!isAllowed(rawUrl)) {
    return Response.json({ error: 'Dominio no permitido' }, { status: 403 });
  }

  const fetchUrl = toMp31(rawUrl);

  try {
    const upstream = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioReelBot/1.0)' },
    });
    if (!upstream.ok) {
      return Response.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';

    return new Response(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
