// I/O de los turnos de Meet: config en site_config/meet + lo ocupado del Google Calendar de Mariano.
// Sin calendario conectado no se ofrecen turnos (no se promete un horario que no se puede chequear).
import { normalizarConfig, turnosLibres, turnoValido, MEET_DEFAULT } from '@/lib/meetSlots';
import { getCalendarAuth, ocupados } from '@/lib/googleCalendar';

const DIA = 86400000;

export async function cargarConfigMeet(db) {
  const snap = await db.collection('site_config').doc('meet').get().catch(() => null);
  return normalizarConfig(snap?.exists ? snap.data() : MEET_DEFAULT);
}

async function ocupadoDesdeAhora(db, config, now) {
  const auth = await getCalendarAuth(db);
  if (!auth) return null;
  return ocupados({ accessToken: auth.accessToken, desde: new Date(now).toISOString(), hasta: new Date(now + (config.maxDias + 1) * DIA).toISOString() });
}

export async function turnosPublicos(db, { now = Date.now() } = {}) {
  const config = await cargarConfigMeet(db);
  const busy = await ocupadoDesdeAhora(db, config, now);
  if (!busy) return { disponible: false, turnos: [] };
  return { disponible: true, turnos: turnosLibres({ config, ocupados: busy, now }), minutos: config.minutos };
}

export async function validarTurnoServidor(db, inicioISO, { now = Date.now() } = {}) {
  const config = await cargarConfigMeet(db);
  const busy = await ocupadoDesdeAhora(db, config, now);
  if (!busy) return false;
  return turnoValido(inicioISO, { config, ocupados: busy, now });
}
