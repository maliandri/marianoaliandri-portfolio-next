export const dynamic = 'force-dynamic';

const MAKE_WEBHOOK = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';
const CRON_SECRET  = process.env.CRON_SECRET;

const DIA_MAP = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function nowInArgentina() {
  const now = new Date();
  const str = now.toLocaleString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'long',
  });
  // str: "2024-05-13, 09:05 Monday" — parseamos HH:MM y día
  const [datePart, timePart] = str.split(', ');
  // timePart puede ser "09:05 Monday" o "09:05"
  const timeOnly = timePart.trim().split(' ')[0]; // "09:05"

  // Día de la semana
  const dayIndex = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  ).getDay();

  return { hora: timeOnly, diaNombre: DIA_MAP[dayIndex] };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(request) {
  // 1. Verificar secret
  const auth = request.headers.get('Authorization') || '';
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Obtener hora y día en Argentina
  const { hora, diaNombre } = nowInArgentina();
  console.log(`[cron/social] Ejecutando — día: ${diaNombre}, hora: ${hora}`);

  // 3. Leer config de Firestore (Firebase Admin)
  let config;
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const { initAdmin }    = await import('../../../../lib/firebase-admin.js');
    initAdmin();
    const adminDb = getFirestore();
    const snap = await adminDb.collection('cron_schedule').doc('config').get();
    if (!snap.exists) {
      return Response.json({ ok: true, msg: 'Sin configuración' });
    }
    config = snap.data();
  } catch (e) {
    console.error('[cron/social] Error leyendo Firestore:', e);
    return Response.json({ error: 'Firestore error', message: e.message }, { status: 500 });
  }

  // 4. Verificar si el cron está activo
  if (!config.active) {
    console.log('[cron/social] Cron pausado — sin acción');
    return Response.json({ ok: true, msg: 'Cron pausado' });
  }

  // 5. Filtrar slots del día + hora actual
  const slotsHoy = (config.schedule?.[diaNombre] || []).filter(
    (slot) => slot.hora && slot.hora === hora && slot.contenido
  );

  if (slotsHoy.length === 0) {
    console.log(`[cron/social] Sin slots para ${diaNombre} ${hora}`);
    return Response.json({ ok: true, msg: 'Sin slots en este minuto', dia: diaNombre, hora });
  }

  console.log(`[cron/social] ${slotsHoy.length} slot(s) a publicar`);

  // 6. Publicar cada slot
  const resultados = [];
  for (let i = 0; i < slotsHoy.length; i++) {
    const slot = slotsHoy[i];
    if (i > 0) await sleep(2000); // delay entre publicaciones

    const networksMap = {
      'LinkedIn': ['linkedin'],
      'FB+IG':    ['facebook', 'instagram'],
      'Todas':    ['linkedin', 'facebook', 'instagram'],
    };

    const payload = {
      type:     slot.tipo === 'Reel' ? 'reel' : 'post',
      text:     slot.contenido.nombre,
      networks: networksMap[slot.redes] || ['linkedin'],
      useAI:    true,
      aiProvider: 'gemini',
      metadata: {
        contentType: slot.contenido.grupo,
        ...slot.contenido.data,
      },
    };

    try {
      const res = await fetch(MAKE_WEBHOOK, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const text = await res.text();
      console.log(`[cron/social] Slot "${slot.contenido.nombre}" → ${res.status} ${text}`);
      resultados.push({ nombre: slot.contenido.nombre, status: res.status, ok: res.ok });
    } catch (e) {
      console.error(`[cron/social] Error en slot "${slot.contenido.nombre}":`, e.message);
      resultados.push({ nombre: slot.contenido.nombre, error: e.message });
    }
  }

  return Response.json({
    ok:   true,
    dia:  diaNombre,
    hora,
    publicados: resultados,
  });
}
