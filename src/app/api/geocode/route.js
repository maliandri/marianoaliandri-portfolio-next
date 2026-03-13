export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return Response.json({ error: 'address is required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 500 });
  }

  // Usar Places API (New) Text Search — ya habilitada en la key
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.location,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: address }),
  });

  const data = await res.json();

  if (!data.places?.length) {
    return Response.json({ error: 'No results found' }, { status: 404 });
  }

  const place = data.places[0];
  return Response.json({
    lat: place.location.latitude,
    lng: place.location.longitude,
    formatted_address: place.formattedAddress,
  });
}
