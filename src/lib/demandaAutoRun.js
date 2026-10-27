// Informes de demanda automáticos: cada corrida toma la próxima zona, junta la demanda de sus
// localidades (autocompletado de Google, gratis), guarda el informe en `demanda_reportes` (público
// en /demanda) y lo anuncia: carrusel en Facebook + Instagram (Make) y PDF en LinkedIn (API), ver
// src/lib/demandaPublish.js. La disparan el cron de Vercel (vercel.json, mar–vie 18:00 ART) y el
// botón "Correr ahora" del admin (force: true).
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { analyzedConCache } from '@/lib/rubroDemand';
import { ZONAS_SEMILLA } from '@/data/demandaZonas';
import {
  aggregateZone, withCambios, pickZona, busquedaDe, buildDemandaCaption, MIN_RUBROS_CON_DATOS,
} from '@/lib/demandaReport';
import { prepararPlacas, publicarDemanda } from '@/lib/demandaPublish';
import { sendAlert } from '@/lib/alert';

const CONFIG = 'demanda_auto';
const RUNS = 'demanda_auto_runs';
export const REPORTES = 'demanda_reportes';
const LOCK_MS = 10 * 60 * 1000;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // datos de hoy (reusa lo que ya buscó el Lead Finder en el día)

export async function loadDemandaConfig(db) {
  const snap = await db.collection(CONFIG).doc('config').get();
  const d = snap.exists ? snap.data() || {} : {};
  return {
    activo: d.activo === true, // arranca apagada: se prende desde el admin tras probar "Correr ahora"
    zonas: d.zonas?.length ? d.zonas : ZONAS_SEMILLA,
    ultimaCorrida: d.ultimaCorrida || {},
    ultimoReporte: d.ultimoReporte || {},
    lock: d.lock || null,
  };
}

async function acquireLock(db, nowMs) {
  const ref = db.collection(CONFIG).doc('config');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if ((snap.exists ? snap.data().lock?.until || 0 : 0) > nowMs) return false;
    tx.set(ref, { lock: { until: nowMs + LOCK_MS } }, { merge: true });
    return true;
  });
}

async function previousTop(db, reportId) {
  if (!reportId) return null;
  try {
    const snap = await db.collection(REPORTES).doc(reportId).get();
    return snap.exists ? snap.data().top : null;
  } catch {
    return null;
  }
}

function revalidar(id) {
  // Solo existe dentro de Next (no en tests ni scripts); el ISR de 1 h igual la pone al día.
  return import('next/cache')
    .then(({ revalidatePath }) => { revalidatePath('/demanda'); revalidatePath(`/demanda/${id}`); })
    .catch(() => {});
}

export async function runDemandaAuto({ force = false, zonaId = null, publicar = true, now = Date.now } = {}) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');
  const nowMs = now();
  const config = await loadDemandaConfig(db);
  if (!force && !config.activo) return { skipped: 'inactivo' };

  const zona = zonaId ? config.zonas.find(z => z.id === zonaId) : pickZona(config, nowMs);
  if (!zona) return { skipped: zonaId ? 'zona_inexistente' : 'sin_zonas' };
  if (!(await acquireLock(db, nowMs))) return { skipped: 'en_curso' };

  const run = { estado: 'error', zona: zona.nombre, zonaId: zona.id, reporteId: null };
  const patch = { lock: { until: 0 } };
  try {
    const perLocalidad = [];
    const sinDatos = [];
    for (const { localidad } of zona.localidades) {
      const busqueda = busquedaDe(localidad);
      const analyzed = await analyzedConCache(db, busqueda, { maxAgeMs: CACHE_MAX_AGE_MS });
      if (analyzed.some(r => r.count > 0)) perLocalidad.push({ localidad, busqueda, analyzed });
      else sinDatos.push(localidad);
    }
    const { top, rubrosConDatos } = aggregateZone(perLocalidad);
    run.rubrosConDatos = rubrosConDatos;
    if (sinDatos.length) run.localidadesSinDatos = sinDatos;

    if (rubrosConDatos < MIN_RUBROS_CON_DATOS || sinDatos.length > zona.localidades.length / 2) {
      run.estado = 'sin_datos';
      run.error = `Google devolvió pocos datos (${rubrosConDatos} rubros; sin datos: ${sinDatos.join(', ') || 'ninguna'})`;
    } else {
      const reporte = {
        zonaId: zona.id,
        zona: zona.nombre,
        localidades: perLocalidad.map(p => p.localidad),
        provincias: [...new Set(zona.localidades.filter(l => perLocalidad.some(p => p.localidad === l.localidad)).map(l => l.provincia))],
        top: withCambios(top, await previousTop(db, config.ultimoReporte[zona.id])),
        rubrosConDatos,
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
      };
      const ref = await db.collection(REPORTES).add(reporte);
      run.reporteId = ref.id;
      patch.ultimaCorrida = { [zona.id]: nowMs };
      patch.ultimoReporte = { [zona.id]: ref.id };
      await revalidar(ref.id);

      // Las capturas se sacan siempre (también sin publicar): sirven de vista previa y de imagen para compartir.
      // Van después de revalidar: Microlink tiene que ver el informe recién creado.
      let placas = null;
      try {
        placas = await prepararPlacas(reporte, ref.id);
        run.placas = placas.urls;
        await ref.update({ slides: placas.urls }).catch(() => {});
      } catch (e) {
        run.error = `No se pudieron sacar las capturas del informe: ${e.message}`;
      }

      if (!publicar) {
        run.estado = 'guardado';
      } else if (!placas) {
        run.estado = 'post_fallido';
      } else {
        const caption = buildDemandaCaption(reporte, ref.id);
        run.redes = await publicarDemanda({ db, reporte, imagenes: placas.imagenes, urls: placas.urls, caption });
        const fallas = Object.entries(run.redes).filter(([, r]) => !r.ok);
        run.estado = fallas.length ? 'post_fallido' : 'ok';
        if (fallas.length) {
          const nombres = { facebookInstagram: 'Facebook + Instagram', linkedin: 'LinkedIn' };
          run.error = fallas.map(([k, r]) => `${nombres[k]}: ${r.error}`).join(' · ');
        }
        await ref.update({ postEstado: run.estado, redes: run.redes, ...(run.error ? { postError: run.error } : {}) }).catch(() => {});
      }
    }
  } catch (e) {
    run.estado = 'error';
    run.error = e.message;
  } finally {
    await db.collection(RUNS).add({ ...run, duracionMs: now() - nowMs, createdAt: FieldValue.serverTimestamp() })
      .catch(e => console.error('[demanda-auto] no se pudo registrar el run:', e.message));
    await db.collection(CONFIG).doc('config').set(patch, { merge: true })
      .catch(e => console.error('[demanda-auto] no se pudo liberar el candado:', e.message));
  }

  if (['error', 'sin_datos', 'post_fallido'].includes(run.estado)) {
    await sendAlert({
      key: `demanda:${run.estado}`,
      titulo: `Informe de demanda: ${run.estado} (${zona.nombre})`,
      detalle: run.error || '',
      contexto: { zona: zona.nombre, reporte: run.reporteId },
    });
  }
  return run;
}
