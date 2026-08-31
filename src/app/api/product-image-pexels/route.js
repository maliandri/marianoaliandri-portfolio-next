export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Palabras clave por categoría para buscar una foto relevante en Pexels.
const CATEGORY_QUERY = {
  'web-development': 'website design laptop',
  'data-analytics': 'data dashboard analytics',
  'consulting': 'business meeting strategy',
  'store': 'ecommerce online shopping',
  'custom': 'technology software',
};

// Busca una foto gratuita en Pexels y la guarda como imagen del producto.
// POST { adminPassword, id, name, description, category, query? }
export async function POST(request) {
  try {
    const { adminPassword, id, name = '', category = '', query } = await request.json();
    if (adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!id) return Response.json({ error: 'Falta el ID del producto' }, { status: 400 });

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return Response.json({ error: 'PEXELS_API_KEY no configurada' }, { status: 500 });

    const q = (query && String(query).trim()) || CATEGORY_QUERY[category] || name || 'technology';

    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Pexels error ${res.status}: ${err}` }, { status: 502 });
    }
    const data = await res.json();
    const photos = data?.photos || [];
    if (!photos.length) return Response.json({ error: `Sin resultados en Pexels para "${q}"` }, { status: 404 });

    // Elegir una al azar entre las primeras para variar
    const photo = photos[Math.floor(Math.random() * Math.min(photos.length, 6))];
    const imageUrl = photo?.src?.landscape || photo?.src?.large || photo?.src?.original;
    if (!imageUrl) return Response.json({ error: 'Foto sin URL utilizable' }, { status: 502 });

    // Devuelve la URL; el cliente decide si la agrega a la galería del producto.
    return Response.json({ success: true, imageUrl, query: q, credit: photo?.photographer });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
