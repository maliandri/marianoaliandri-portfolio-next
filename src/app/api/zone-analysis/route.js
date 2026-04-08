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

  // Construir fecha futura preservando DÍA DE SEMANA (avanzar de a 7 días)
  // Así el tráfico y el open_count usan siempre el mismo día de semana
  let dt = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
  const minFuture = Date.now() + 10 * 60 * 1000;
  while (dt.getTime() < minFuture) dt = new Date(dt.getTime() + 7 * 24 * 3600 * 1000);

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

async function fetchPlacesForType(centerLat, centerLng, radius, types) {
  const body = {
    includedTypes: types,
    maxResultCount: 20,
    locationRestriction: {
      circle: { center: { latitude: centerLat, longitude: centerLng }, radius },
    },
  };
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.regularOpeningHours,places.types,places.location,places.currentOpeningHours',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.places || [];
}

// Grupos de tipos — una request por grupo (máx 20 resultados c/u)
const ALL_TYPE_GROUPS = [
  // Gastronomía
  ['restaurant', 'cafe', 'bakery', 'bar', 'fast_food_restaurant'],
  ['pizza_restaurant', 'sandwich_shop', 'hamburger_restaurant', 'ice_cream_shop', 'meal_takeaway'],
  ['night_club', 'wine_bar', 'seafood_restaurant', 'steak_house', 'brunch_restaurant'],
  // Almacenes y supermercados
  ['supermarket', 'grocery_store', 'convenience_store', 'food', 'meal_delivery'],
  // Salud y farmacia
  ['pharmacy', 'drugstore', 'doctor', 'dentist', 'hospital'],
  ['veterinary_care', 'physiotherapist', 'optician', 'mental_health_practitioner'],
  // Ropa, calzado y accesorios
  ['clothing_store', 'shoe_store', 'jewelry_store', 'gift_shop', 'florist'],
  // Electrónica y hogar
  ['electronics_store', 'computer_store', 'cell_phone_store', 'home_goods_store', 'furniture_store'],
  // Construcción y servicios del hogar
  ['hardware_store', 'plumber', 'electrician', 'painter', 'locksmith'],
  // Comercio general
  ['department_store', 'shopping_mall', 'book_store', 'toy_store', 'sporting_goods_store'],
  ['pet_store', 'bicycle_store', 'auto_parts_store', 'laundry', 'dry_cleaning'],
  // Finanzas y servicios profesionales
  ['bank', 'atm', 'insurance_agency', 'real_estate_agency', 'accounting'],
  ['lawyer', 'travel_agency', 'moving_company', 'courier_service'],
  // Belleza y bienestar
  ['beauty_salon', 'hair_care', 'barber_shop', 'nail_salon', 'spa'],
  ['gym', 'fitness_center', 'yoga_studio'],
  // Automotor
  ['gas_station', 'car_repair', 'car_wash', 'car_dealer', 'parking'],
  // Ocio y cultura
  ['movie_theater', 'bowling_alley', 'casino', 'stadium', 'performing_arts_theater'],
  // Educación
  ['school', 'university', 'library', 'driving_school', 'language_school'],
];

const TIPO_FILTER_MAP = {
  restaurant:   ['restaurant', 'cafe', 'bakery', 'bar', 'fast_food_restaurant', 'pizza_restaurant', 'sandwich_shop', 'hamburger_restaurant', 'ice_cream_shop', 'meal_takeaway', 'night_club', 'wine_bar', 'seafood_restaurant', 'steak_house'],
  combustible:  ['gas_station'],
  supermercado: ['supermarket', 'grocery_store', 'convenience_store'],
  comercio:     ['clothing_store', 'shoe_store', 'electronics_store', 'department_store', 'shopping_mall', 'book_store', 'toy_store', 'sporting_goods_store', 'pet_store', 'home_goods_store', 'furniture_store'],
  shopping:     ['shopping_mall', 'department_store'],
};

async function fetchPlaces(bounds, tipos) {
  const { centerLat, centerLng, radius } = boundsToCircle(bounds);

  const groups = tipos.includes('todos')
    ? ALL_TYPE_GROUPS
    : [tipos.flatMap(t => TIPO_FILTER_MAP[t] || []).filter(Boolean)];

  // Todas las requests en paralelo
  const results = await Promise.all(
    groups.map(types => fetchPlacesForType(centerLat, centerLng, radius, types))
  );

  // Deduplicar por nombre (mismo local puede aparecer en varios grupos)
  const seen = new Set();
  const places = [];
  for (const group of results) {
    for (const p of group) {
      const key = p.displayName?.text?.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        places.push(p);
      }
    }
  }
  return places;
}

// Determina si un lugar está abierto a una hora específica del día
// dayOfWeek: 0=Dom, 1=Lun, ..., 6=Sab
const CATEGORY_TYPES = {
  'Gastronomía':  ['restaurant','cafe','bakery','bar','fast_food_restaurant','pizza_restaurant','sandwich_shop','hamburger_restaurant','ice_cream_shop','meal_takeaway','night_club','wine_bar','seafood_restaurant','steak_house','brunch_restaurant','food'],
  'Supermercados':['supermarket','grocery_store','convenience_store','meal_delivery'],
  'Salud':        ['pharmacy','drugstore','doctor','dentist','hospital','veterinary_care','physiotherapist','optician','mental_health_practitioner'],
  'Indumentaria': ['clothing_store','shoe_store','jewelry_store','gift_shop','florist'],
  'Tecnología':   ['electronics_store','computer_store','cell_phone_store'],
  'Hogar':        ['home_goods_store','furniture_store','hardware_store'],
  'Servicios':    ['bank','atm','insurance_agency','real_estate_agency','accounting','lawyer','travel_agency','courier_service','moving_company'],
  'Belleza':      ['beauty_salon','hair_care','barber_shop','nail_salon','spa','gym','fitness_center','yoga_studio','laundry','dry_cleaning'],
  'Automotor':    ['gas_station','car_repair','car_wash','car_dealer','auto_parts_store','parking'],
  'Comercios':    ['department_store','shopping_mall','book_store','toy_store','sporting_goods_store','pet_store','bicycle_store'],
  'Educación':    ['school','university','library','driving_school','language_school'],
  'Ocio':         ['movie_theater','bowling_alley','casino','stadium','performing_arts_theater'],
};

function categorizePlace(place) {
  const types = place.types || [];
  for (const [cat, catTypes] of Object.entries(CATEGORY_TYPES)) {
    if (types.some(t => catTypes.includes(t))) return cat;
  }
  return 'Otros';
}

function isOpenAtHour(place, dayOfWeek, hour) {
  const periods = place.regularOpeningHours?.periods || place.currentOpeningHours?.periods || [];
  if (!periods.length) return null; // sin datos
  return periods.some(p => {
    if (p.open?.day !== dayOfWeek) return false;
    const openH  = p.open.hour  ?? 0;
    const closeH = p.close?.hour ?? 24;
    // Manejo de cierre en madrugada (ej: abre 20hs cierra 2hs)
    if (closeH < openH) return hour >= openH || hour < closeH;
    return hour >= openH && hour < closeH;
  });
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

    // Places — traer antes del hourly para cruzar datos
    const places      = await fetchPlaces(bounds, tipos);
    const totalPlaces = places.length;
    const ratings     = places.filter(p => p.rating).map(p => p.rating);
    const avgRating   = ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
    const topPlaces   = [...places]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)
      .map(p => ({ name: p.displayName?.text || 'Sin nombre', rating: p.rating || 0, type: p.types?.[0] || 'local' }));

    // Conteo por categoría — si hay 20 es probable que haya más (límite API)
    const byCategory = {};
    for (const p of places) {
      const cat = categorizePlace(p);
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // Día de semana de la fecha analizada (0=Dom, 1=Lun, ...)
    const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();

    // Hourly data con comercios abiertos + índice de afluencia por hora
    const hourlyData = trafficByHour.map(h => {
      const congestion = h.minutes !== null ? congestionLevel(h.minutes, baseMinutes) : 'UNKNOWN';

      // Contar comercios abiertos a esta hora
      // - Con horarios: usar regularOpeningHours
      // - Sin horarios cargados en Google: asumir 9-21hs (comercio estándar AR)
      const openCount = places.reduce((count, p) => {
        const periods = p.regularOpeningHours?.periods || p.currentOpeningHours?.periods || [];
        if (periods.length > 0) {
          return count + (isOpenAtHour(p, dayOfWeek, h.hour) ? 1 : 0);
        }
        // Sin datos: asumir abierto en horario comercial estándar
        return count + (h.hour >= 9 && h.hour < 21 ? 1 : 0);
      }, 0);

      return {
        hour:       h.hour,
        label:      `${String(h.hour).padStart(2,'0')}:00`,
        minutes:    h.minutes,
        congestion,
        open_count: openCount,
      };
    });

    // Top 3 horas pico
    const peakHours = [...validHours]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3)
      .map(h => ({ hour: h.hour, label: `${String(h.hour).padStart(2,'0')}:00`, minutes: h.minutes }));

    // Hora valle
    const valleyHour = validHours.reduce(
      (min, h) => h.minutes < min.minutes ? h : min,
      validHours[0] || { hour: 13, minutes: baseMinutes }
    );

    // Diferencia pico vs valle
    const peakMinutes  = peakHours[0]?.minutes ?? baseMinutes;
    const deltaMinutes = peakMinutes - valleyHour.minutes;
    const deltaPercent = valleyHour.minutes > 0 ? Math.round((deltaMinutes / valleyHour.minutes) * 100) : 0;

    const commercial = { total_places: totalPlaces, avg_rating: avgRating, top_places: topPlaces, by_category: byCategory };
    const mapImageUrl = buildStaticMapUrl(bounds);

    const summary = `Análisis de zona "${titulo}" (${dateStr}): hora pico ${peakHours[0]?.label} con ${peakMinutes} min de viaje, hora valle ${valleyHour.label} con ${valleyHour.minutes} min. Diferencia: ${deltaMinutes} min más (${deltaPercent}% de demora extra en hora pico). Zona comercial: ${totalPlaces} locales, rating promedio ${avgRating}.`;

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
