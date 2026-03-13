export const runtime = 'nodejs';
export const maxDuration = 30;

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
// Static Maps usa la clave del browser (tiene Static Maps API habilitada + restricción de dominio)
const MAPS_STATIC_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || process.env.GOOGLE_PLACES_API_KEY;

function congestionLevel(minutes, baseMinutes) {
  const ratio = minutes / (baseMinutes || 5);
  if (ratio < 1.2) return 'LOW';
  if (ratio < 1.6) return 'MEDIUM';
  return 'HIGH';
}

function buildCirclePolyline(lat, lng, radiusMeters, points = 16) {
  const R = 6371000;
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const angle = (2 * Math.PI * i) / points;
    const dLat = (radiusMeters / R) * (180 / Math.PI) * Math.cos(angle);
    const dLng = (radiusMeters / R) * (180 / Math.PI) * Math.sin(angle) / Math.cos((lat * Math.PI) / 180);
    coords.push(`${(lat + dLat).toFixed(6)},${(lng + dLng).toFixed(6)}`);
  }
  return coords.join('|');
}

async function fetchTraffic(lat, lng, departureTime) {
  const offset = 0.008;
  const body = {
    origin: { location: { latLng: { latitude: lat + offset, longitude: lng } } },
    destination: { location: { latLng: { latitude: lat - offset, longitude: lng } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    departureTime: new Date(departureTime).toISOString(),
  };

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'routes.duration,routes.travelAdvisory',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Routes API error:', err);
    return { minutes: null, raw: null };
  }

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return { minutes: null, raw: null };

  const durationSecs = parseInt(route.duration?.replace('s', '') || '0', 10);
  return { minutes: Math.round(durationSecs / 60), raw: route };
}

async function fetchPlaces(lat, lng, radiusMeters, tipos) {
  const typeMap = {
    restaurant: 'restaurant',
    combustible: 'gas_station',
    supermercado: 'supermarket',
    comercio: 'store',
    shopping: 'shopping_mall',
  };

  const includedTypes = tipos.includes('todos')
    ? Object.values(typeMap)
    : tipos.map(t => typeMap[t]).filter(Boolean);

  const body = {
    includedTypes: includedTypes.length ? includedTypes : undefined,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
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

  if (!res.ok) {
    const err = await res.text();
    console.error('Places API error:', err);
    return [];
  }

  const data = await res.json();
  return data.places || [];
}

function buildStaticMapUrl(lat, lng, radiusMeters) {
  const zoom = radiusMeters <= 500 ? 16 : radiusMeters <= 1000 ? 15 : radiusMeters <= 2000 ? 14 : 13;
  const circlePath = buildCirclePolyline(lat, lng, radiusMeters);
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: '800x400',
    scale: '2',
    maptype: 'roadmap',
    markers: `color:red|${lat},${lng}`,
    path: `color:0x4f46e599|fillcolor:0x4f46e522|weight:2|${circlePath}`,
    key: MAPS_STATIC_KEY,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

// Genera N datetimes equidistantes dentro del rango.
// Si alguno cae en el pasado, lo avanza por semanas completas hasta que sea futuro.
function sampleDatetimes(dateFrom, timeFrom, dateTo, timeTo, n = 3) {
  const start = new Date(`${dateFrom}T${timeFrom}:00`);
  const end = new Date(`${dateTo}T${timeTo}:00`);
  if (isNaN(start) || isNaN(end)) return [];
  const diff = end.getTime() - start.getTime();
  const minFuture = Date.now() + 5 * 60 * 1000;
  const samples = [];
  for (let i = 0; i < n; i++) {
    const fraction = n === 1 ? 0.5 : i / (n - 1);
    let dt = new Date(start.getTime() + diff * fraction);
    // Avanzar por semanas hasta que sea futuro
    while (dt.getTime() < minFuture) {
      dt = new Date(dt.getTime() + 7 * 24 * 3600 * 1000);
    }
    samples.push(dt.toISOString());
  }
  return samples;
}

async function fetchTrafficRange(lat, lng, datetimes) {
  const results = await Promise.all(datetimes.map(dt => fetchTraffic(lat, lng, dt)));
  const valid = results.filter(r => r.minutes !== null);
  if (!valid.length) return { minutes: null };
  const avg = Math.round(valid.reduce((a, r) => a + r.minutes, 0) / valid.length);
  return { minutes: avg };
}

export async function POST(req) {
  try {
    const { zona, periodo1, periodo2 } = await req.json();
    const { lat, lng, radio, tipos = ['todos'], titulo } = zona;

    const samples1 = sampleDatetimes(periodo1.dateFrom, periodo1.timeFrom, periodo1.dateTo, periodo1.timeTo, 3);
    const samples2 = sampleDatetimes(periodo2.dateFrom, periodo2.timeFrom, periodo2.dateTo, periodo2.timeTo, 3);

    const [traffic1, traffic2, places] = await Promise.all([
      fetchTrafficRange(lat, lng, samples1),
      fetchTrafficRange(lat, lng, samples2),
      fetchPlaces(lat, lng, radio, tipos),
    ]);

    // Traffic comparison
    const base = 5;
    const t1Minutes = traffic1.minutes ?? base;
    const t2Minutes = traffic2.minutes ?? base;
    const deltaMins = t2Minutes - t1Minutes;
    const deltaPercent = t1Minutes > 0 ? Math.round((deltaMins / t1Minutes) * 100) : 0;

    const trafficResult = {
      periodo1: {
        label: periodo1.label,
        minutes: t1Minutes,
        congestion: congestionLevel(t1Minutes, base),
      },
      periodo2: {
        label: periodo2.label,
        minutes: t2Minutes,
        congestion: congestionLevel(t2Minutes, base),
      },
      delta_minutes: deltaMins,
      delta_direction: deltaMins > 0 ? 'worse' : deltaMins < 0 ? 'better' : 'equal',
      delta_percent: Math.abs(deltaPercent),
    };

    // Commercial summary
    const totalPlaces = places.length;
    const openNow = places.filter(p => p.regularOpeningHours?.openNow).length;
    const ratings = places.filter(p => p.rating).map(p => p.rating);
    const avgRating = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    const byType = {};
    places.forEach(p => {
      const type = p.types?.[0] || 'other';
      byType[type] = (byType[type] || 0) + 1;
    });

    const topPlaces = [...places]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.displayName?.text || 'Sin nombre',
        rating: p.rating || 0,
        type: p.types?.[0] || 'local',
      }));

    const commercial = { total_places: totalPlaces, open_now: openNow, avg_rating: avgRating, top_places: topPlaces, by_type: byType };

    const mapImageUrl = buildStaticMapUrl(lat, lng, radio);

    const congestionLabel = { LOW: 'baja', MEDIUM: 'moderada', HIGH: 'alta' };
    const fmtRange = p => `${p.dateFrom} ${p.timeFrom} – ${p.dateTo} ${p.timeTo}`;
    const summary = `Análisis de zona "${titulo}": Período 1 (${periodo1.label}: ${fmtRange(periodo1)}) promedio ${t1Minutes} min (congestión ${congestionLabel[trafficResult.periodo1.congestion]}). Período 2 (${periodo2.label}: ${fmtRange(periodo2)}) promedio ${t2Minutes} min (congestión ${congestionLabel[trafficResult.periodo2.congestion]}). Diferencia: ${Math.abs(deltaMins)} min ${deltaMins > 0 ? 'más lento' : 'más rápido'} en el período 2 (${Math.abs(deltaPercent)}%). Zona comercial: ${totalPlaces} locales, ${openNow} abiertos, rating promedio ${avgRating}.`;

    return Response.json({
      zona_titulo: titulo,
      map_image_url: mapImageUrl,
      traffic: trafficResult,
      commercial,
      summary,
    });
  } catch (err) {
    console.error('zone-analysis error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
