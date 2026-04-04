export const runtime = 'nodejs';
export const maxDuration = 60;

const API_KEY        = process.env.GOOGLE_PLACES_API_KEY;
const MAPS_STATIC_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || process.env.GOOGLE_PLACES_API_KEY;

function congestionLevel(minutes, baseMinutes) {
  const ratio = minutes / (baseMinutes || 1);
  if (ratio < 1.1)  return 'LOW';
  if (ratio < 1.35) return 'MEDIUM';
  return 'HIGH';
}

// Tráfico SW→NE del rectángulo para una hora específica del día dado
async function fetchTrafficAtHour(bounds, dateStr, hour) {
  const { north, south, east, west } = bounds;

  // Construir fecha futura preservando hora del día
  let dt = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
  const minFuture = Date.now() + 10 * 60 * 1000;
  while (dt.getTime() < minFuture) dt = new Date(dt.getTime() + 24 * 3600 * 1000);

  const body = {
    origin:      { location: { latLng: { latitude: south, longitude: west } } },
    destination: { location: { latLng: { latitude: north, longitude: east } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    departureTime: dt.toISOString(),
  };

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'routes.duration',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Routes API error h${hour}:`, await res.text());
    return null;
  }

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  const secs = parseInt(route.duration?.replace('s', '') || '0', 10);
  return Math.round(secs / 60);
}

// Places con bounding box rectangular
// Distancia en metros entre dos puntos (Haversine simplificado)
function boundsToCircle(bounds) {
  const { north, south, east, west } = bounds;
  const centerLat = (north + south) / 2;
  const centerLng = (east + west)  / 2;
  const R = 6371000;
  const dLat = ((north - south) / 2) * (Math.PI / 180);
  const dLng = ((east  - west)  / 2) * (Math.PI / 180) * Math.cos(centerLat * Math.PI / 180);
  const radius = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * R);
  return { centerLat, centerLng, radius: Math.max(radius, 100) };
}

async function fetchPlaces(bounds, tipos) {
  const { centerLat, centerLng, radius } = boundsToCircle(bounds);
  const typeMap = {
    restaurant:  'restaurant',
    combustible: 'gas_station',
    supermercado:'supermarket',
    comercio:    'store',
    shopping:    'shopping_mall',
  };

  const includedTypes = tipos.includes('todos')
    ? Object.values(typeMap)
    : tipos.map(t => typeMap[t]).filter(Boolean);

  const body = {
    includedTypes: includedTypes.length ? includedTypes : undefined,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: centerLat, longitude: centerLng },
        radius,
      },
    },
  };

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.regularOpeningHours,places.types,places.location',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) { console.error('Places API error:', await res.text()); return []; }
  const data = await res.json();
  return data.places || [];
}

function buildStaticMapUrl(bounds) {
  const { north, south, east, west } = bounds;
  const centerLat = (north + south) / 2;
  const centerLng = (east + west)  / 2;
  const latSpan   = north - south;
  const zoom      = latSpan > 0.05 ? 13 : latSpan > 0.02 ? 14 : latSpan > 0.01 ? 15 : 16;
  const rectPath  = `${south},${west}|${north},${west}|${north},${east}|${south},${east}|${south},${west}`;
  const params    = new URLSearchParams({
    center:  `${centerLat},${centerLng}`,
    zoom:    String(zoom),
    size:    '800x400',
    scale:   '2',
    maptype: 'roadmap',
    markers: `color:red|${centerLat},${centerLng}`,
    path:    `color:0x4f46e599|fillcolor:0x4f46e522|weight:2|${rectPath}`,
    key:     MAPS_STATIC_KEY,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export async function POST(req) {
  try {
    const { zona } = await req.json();
    const { bounds, tipos = ['todos'], titulo, fecha } = zona;

    if (!bounds?.north) return Response.json({ error: 'bounds requerido' }, { status: 400 });

    const dateStr = fecha || new Date().toISOString().split('T')[0];

    // Horas a analizar: 6am a 23pm
    const HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];

    // Lanzar todas las consultas en paralelo (lotes de 6 para no saturar)
    const trafficByHour = [];
    for (let i = 0; i < HOURS.length; i += 6) {
      const batch = HOURS.slice(i, i + 6);
      const results = await Promise.all(batch.map(h => fetchTrafficAtHour(bounds, dateStr, h)));
      results.forEach((mins, j) => trafficByHour.push({ hour: batch[j], minutes: mins }));
    }

    // Filtrar nulos
    const validHours = trafficByHour.filter(h => h.minutes !== null);

    // Baseline = hora con menos tráfico (valle)
    const baseMinutes = validHours.length
      ? Math.min(...validHours.map(h => h.minutes))
      : 5;

    // Agregar nivel de congestión
    const hourlyData = trafficByHour.map(h => ({
      hour:      h.hour,
      label:     `${String(h.hour).padStart(2,'0')}:00`,
      minutes:   h.minutes,
      congestion: h.minutes !== null ? congestionLevel(h.minutes, baseMinutes) : 'UNKNOWN',
    }));

    // Top 3 horas pico
    const peakHours = [...validHours]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3)
      .map(h => ({ hour: h.hour, label: `${String(h.hour).padStart(2,'0')}:00`, minutes: h.minutes }));

    // Hora valle
    const valleyHour = validHours.reduce((min, h) => h.minutes < min.minutes ? h : min, validHours[0] || { hour: 13, minutes: baseMinutes });

    // Diferencia pico vs valle
    const peakMinutes   = peakHours[0]?.minutes ?? baseMinutes;
    const deltaMinutes  = peakMinutes - valleyHour.minutes;
    const deltaPercent  = valleyHour.minutes > 0 ? Math.round((deltaMinutes / valleyHour.minutes) * 100) : 0;

    // Places
    const places   = await fetchPlaces(bounds, tipos);
    const totalPlaces = places.length;
    const openNow     = places.filter(p => p.regularOpeningHours?.openNow).length;
    const ratings     = places.filter(p => p.rating).map(p => p.rating);
    const avgRating   = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;
    const byType = {};
    places.forEach(p => { const t = p.types?.[0] || 'other'; byType[t] = (byType[t] || 0) + 1; });
    const topPlaces = [...places]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)
      .map(p => ({ name: p.displayName?.text || 'Sin nombre', rating: p.rating || 0, type: p.types?.[0] || 'local' }));

    const commercial = { total_places: totalPlaces, open_now: openNow, avg_rating: avgRating, top_places: topPlaces, by_type: byType };
    const mapImageUrl = buildStaticMapUrl(bounds);

    const summary = `Análisis de zona "${titulo}" (${dateStr}): hora pico ${peakHours[0]?.label} con ${peakMinutes} min de viaje, hora valle ${valleyHour.label} con ${valleyHour.minutes} min. Diferencia: ${deltaMinutes} min más (${deltaPercent}% de demora extra en hora pico). Zona comercial: ${totalPlaces} locales, ${openNow} abiertos, rating promedio ${avgRating}.`;

    return Response.json({
      zona_titulo: titulo,
      fecha:       dateStr,
      map_image_url: mapImageUrl,
      hourly:      hourlyData,
      peak_hours:  peakHours,
      valley_hour: valleyHour,
      delta_minutes:  deltaMinutes,
      delta_percent:  deltaPercent,
      base_minutes:   baseMinutes,
      commercial,
      summary,
    });
  } catch (err) {
    console.error('zone-analysis error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
