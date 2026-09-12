export const dynamic = 'force-dynamic';

// Catálogo de música libre/gratis para reels vía Jamendo (https://api.jamendo.com).
// Reemplaza la dependencia de Mubert (pago) por un catálogo real, buscable y
// filtrable por estilo, sin costo. Requiere JAMENDO_CLIENT_ID (gratis, se obtiene
// registrando una app en https://devportal.jamendo.com).

const STYLE_TAGS = {
  ambiental: 'ambient', acustica: 'acoustic', piano: 'piano', jazz: 'jazz',
  folk: 'folk', clasica: 'classical', lounge: 'lounge', chill: 'chill',
  romantica: 'romantic', festivo: 'happy', latina: 'latin',
  instrumental: 'instrumental', electronica: 'electronic', pop: 'pop',
};

// Fallback por mood cuando no hay estilo elegido — mapea a los moods que ya
// usaba el generador (upbeat/chill/corporate/inspirational/tech).
const MOOD_TAGS = {
  upbeat: ['pop', 'electronic+happy', 'dance', 'happy', 'energetic'],
  chill: ['chill', 'lounge', 'ambient+chill', 'relaxing', 'chillout'],
  corporate: ['corporate', 'inspirational+corporate', 'upbeat+corporate', 'business', 'motivational'],
  inspirational: ['inspirational', 'uplifting', 'cinematic', 'epic', 'motivational'],
  tech: ['electronic', 'ambient+electronic', 'synth', 'futuristic', 'techno'],
  default: ['ambient', 'instrumental', 'relaxing', 'acoustic', 'lounge'],
};

const PAGE_SIZE = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mood = searchParams.get('mood') || 'default';
  const style = searchParams.get('style') || '';
  const query = searchParams.get('q') || '';
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const clientId = process.env.JAMENDO_CLIENT_ID;

  if (!clientId) {
    return Response.json({ error: 'JAMENDO_CLIENT_ID no configurado' }, { status: 500 });
  }

  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('audioformat', 'mp32');
  url.searchParams.set('include', 'musicinfo');
  url.searchParams.set('orderby', 'popularity_total');

  if (style && STYLE_TAGS[style]) {
    url.searchParams.set('tags', STYLE_TAGS[style]);
  } else {
    const tagList = MOOD_TAGS[mood] || MOOD_TAGS.default;
    const page = Math.floor(offset / PAGE_SIZE);
    url.searchParams.set('tags', tagList[page % tagList.length]);
  }

  if (query.trim()) url.searchParams.set('namesearch', query.trim());

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Jamendo ${res.status}`);
    const data = await res.json();

    const tracks = (data.results || []).map(t => ({
      id: t.id,
      nombre: t.name,
      artista: t.artist_name,
      duracion: t.duration,
      audioUrl: t.audio,
      imagen: t.album_image,
    }));

    return Response.json({ tracks });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
