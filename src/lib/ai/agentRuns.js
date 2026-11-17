import { FieldValue } from 'firebase-admin/firestore';

// Registro en vivo de las corridas del agente de prospección: cada paso se guarda a medida que ocurre
// (agente_runs/{id}/eventos/{seq}) para que el admin lo mire mientras trabaja. Solo Admin SDK (sin regla = deny).
export const RUNS = 'agente_runs';
export const STALE_MS = 6 * 60 * 1000; // la función dura 300 s: pasado esto, una corrida "corriendo" se cortó
const MAX_EVENTOS = 300;
const corto = (s, n) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n)}…` : s);

// Una corrida "corriendo" que ya pasó el tiempo máximo de la función quedó cortada (timeout, caída).
export function estadoEfectivo(run, now = Date.now()) {
  if (run?.estado === 'corriendo' && now - (run.creadoMs || 0) > STALE_MS) return 'cortado';
  return run?.estado || 'desconocido';
}

export async function crearRun(db, { uid, objetivo, now = Date.now() }) {
  const ref = await db.collection(RUNS).add({
    uid, objetivo: String(objetivo).slice(0, 1000), estado: 'corriendo', creadoMs: now, finMs: null,
    pasos: 0, texto: null, borradores: [], error: null, createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// Hay otra corrida andando (y no es una cortada): se usa para no lanzar dos agentes a la vez.
export async function corridaActiva(db, { now = Date.now() } = {}) {
  const snap = await db.collection(RUNS).orderBy('creadoMs', 'desc').limit(1).get();
  const d = snap.docs[0];
  if (!d) return null;
  const run = d.data();
  return estadoEfectivo(run, now) === 'corriendo' ? { id: d.id, ...run } : null;
}

// Escribe los eventos EN ORDEN (la secuencia se asigna al llamar, no al terminar la escritura) y
// `cerrar` espera a que todos estén guardados antes de marcar la corrida como terminada.
export function crearRegistrador(db, runId, { now = Date.now } = {}) {
  const ref = db.collection(RUNS).doc(runId);
  const pendientes = [];
  let seq = 0;
  return {
    evento(e) {
      if (seq >= MAX_EVENTOS) return;
      seq += 1;
      const doc = { seq, at: now(), ...e, ...(e.texto ? { texto: corto(e.texto, 600) } : {}), ...(e.resumen ? { resumen: corto(e.resumen, 300) } : {}) };
      pendientes.push(ref.collection('eventos').doc(String(seq).padStart(4, '0')).set(doc)
        .catch(err => console.error('[agente] no se pudo guardar un evento:', err.message)));
    },
    async cerrar({ estado, texto = null, borradores = [], pasos = 0, error = null }) {
      await Promise.allSettled(pendientes);
      await ref.update({ estado, texto, borradores, pasos, error: corto(error, 500) ?? null, finMs: now() });
    },
  };
}

// Estado de una corrida + los eventos nuevos (seq > desde), para consultar cada pocos segundos.
export async function leerRun(db, id, { desde = 0, now = Date.now() } = {}) {
  const ref = db.collection(RUNS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const run = snap.data();
  const estado = estadoEfectivo(run, now);
  if (estado === 'cortado' && run.estado === 'corriendo') {
    await ref.update({ estado: 'cortado', finMs: now, error: 'La corrida se cortó sin terminar (tiempo máximo de la función).' }).catch(() => {});
  }
  const ev = await ref.collection('eventos').where('seq', '>', Number(desde) || 0).orderBy('seq').limit(MAX_EVENTOS).get();
  return { id, ...run, estado, eventos: ev.docs.map(d => d.data()) };
}

export async function listarRuns(db, { uid, limit = 10 } = {}) {
  const snap = await db.collection(RUNS).orderBy('creadoMs', 'desc').limit(Math.min(limit, 30)).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => !uid || r.uid === uid)
    .map(r => ({ id: r.id, objetivo: r.objetivo, estado: estadoEfectivo(r), creadoMs: r.creadoMs, finMs: r.finMs, pasos: r.pasos || 0, borradores: (r.borradores || []).length }));
}
