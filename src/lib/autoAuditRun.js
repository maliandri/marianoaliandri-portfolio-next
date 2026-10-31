import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CIUDADES_SEMILLA, RUBROS_SEMILLA } from '@/data/auditoriaAuto';
import { pickNext, comboKey, buildStats, buildPost, DEFAULT_NETWORKS, CANTIDAD_DEFAULT, CANTIDAD_MIN, CANTIDAD_MAX, FAST_MAX_SITES } from '@/lib/autoAudit';
import { runBatch } from '@/lib/autoAuditBatch';
import { saveAuditoria } from '@/lib/auditoriasStore';
import { imageIsReachable } from '@/lib/imageCheck';
import { postToMakeSocial } from '@/lib/makeSocial';
import { auditStoryScreenshotUrl } from '@/lib/socialAuditPost';
import { publishIgStory, igCredsFromEnv } from '../../scripts/igStoryClient.mjs';

const CONFIG_COLLECTION = 'auditoria_auto';
const RUNS_COLLECTION = 'auditoria_auto_runs';
const LOCK_MS = 15 * 60 * 1000;          // un candado huérfano vence solo a los 15 min
const MIN_SITES_TO_SAVE = 5;             // con cuota agotada solo se guarda si hay al menos 5
// Un informe de 1 o 2 sitios no dice nada (pasó con Durlock × Formosa: Google tenía 2 comercios).
// Por debajo de esto la combinación se marca como hecha y se prueba otra en la misma corrida.
const MIN_SITES_TO_PUBLISH = 3;
const MAX_COMBO_ATTEMPTS = 3;

// Historia de Instagram con la captura del informe en formato celular. Sale si Instagram está
// entre las redes y hay IG_ACCESS_TOKEN / IG_USER_ID; un fallo no cambia el estado del post.
async function publishAuditStory(auditoriaId, networks) {
  if (!networks?.includes('instagram') || !igCredsFromEnv()) return null;
  const url = auditStoryScreenshotUrl(auditoriaId);
  // La primera vez Microlink renderiza la captura: se pide antes para que Instagram la encuentre lista.
  const image = await imageIsReachable(url);
  if (!image.ok) return { ok: false, error: `La captura para la historia no responde (Microlink): ${image.detail}` };
  try {
    return { ok: true, id: await publishIgStory(url) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function defaultConfig() {
  return {
    activo: false, // arranca apagada: se activa desde el admin tras probar con "Correr ahora"
    ciudades: [...CIUDADES_SEMILLA],
    rubros: RUBROS_SEMILLA.map(r => ({ ...r })),
    networks: [...DEFAULT_NETWORKS],
    cantidad: CANTIDAD_DEFAULT,
    ultimaCorrida: {},
  };
}

export async function loadConfig(db) {
  const base = defaultConfig();
  const snap = await db.collection(CONFIG_COLLECTION).doc('config').get();
  if (!snap.exists) return base;
  const d = snap.data() || {};
  return {
    ...base,
    ...d,
    activo: d.activo === true,
    ciudades: d.ciudades?.length ? d.ciudades : base.ciudades,
    rubros: d.rubros?.length ? d.rubros : base.rubros,
    networks: d.networks?.length ? d.networks : base.networks,
    cantidad: Number.isInteger(d.cantidad) ? Math.min(CANTIDAD_MAX, Math.max(CANTIDAD_MIN, d.cantidad)) : base.cantidad,
    ultimaCorrida: d.ultimaCorrida || {},
  };
}

async function acquireLock(db, nowMs) {
  const ref = db.collection(CONFIG_COLLECTION).doc('config');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const until = snap.exists ? (snap.data().lock?.until || 0) : 0;
    if (until > nowMs) return false;
    tx.set(ref, { lock: { until: nowMs + LOCK_MS } }, { merge: true });
    return true;
  });
}

function fechaLarga(ms) {
  return new Date(ms).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
  });
}

async function saveReport(combo, results, stats, nowMs, useGemini) {
  const title = `Auditoría SEO de ${stats.total} sitios de ${combo.rubro.label} en ${combo.ciudad} (${fechaLarga(nowMs)})`;
  const config = { ciudades: combo.ciudades?.length ? combo.ciudades : [combo.ciudad], pais: 'Argentina', radioKm: 15, tiposLabels: [combo.rubro.label] };
  return saveAuditoria({ title, config, results, stats, useGemini });
}


// Una corrida de la auditoría automática. La invocan el script de GitHub Actions
// (scripts/auto-audit.mjs) y el botón "Correr ahora" del admin (force: true).
export async function runAutoAudit({
  force = false, now = Date.now, budgetMs = 45000, fast = false, useGemini = true,
} = {}) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');

  const nowMs = now();
  const config = await loadConfig(db);
  if (!force && config.activo !== true) return { skipped: 'inactivo' };
  if (!(await acquireLock(db, nowMs))) return { skipped: 'en_curso' };

  const configRef = db.collection(CONFIG_COLLECTION).doc('config');
  const run = { estado: 'error', combo: null, auditados: 0, auditoriaId: null };
  let combo = null;
  let markRan = false;
  let skipped = null;

  const descartadas = {}; // combinaciones con muy pocos sitios: se marcan para no repetirlas

  try {
    // Tiempo y getDetails (maxCandidates) son un presupuesto por corrida, compartido entre intentos.
    const deadline = nowMs + budgetMs;
    const cantidad = fast ? Math.min(config.cantidad, FAST_MAX_SITES) : config.cantidad;
    const fullCap = 2 * cantidad;
    let candidatesLeft = fullCap;
    let batch = null;
    const conclusivo = (b) => b.agotado === true || (!fast && b.cortadoPorTiempo !== true && (b.examined || 0) >= fullCap);
    for (let i = 0; i < MAX_COMBO_ATTEMPTS; i++) {
      if (i > 0 && (candidatesLeft <= 0 || deadline - now() <= 0)) break;
      const next = pickNext({ ...config, ultimaCorrida: { ...config.ultimaCorrida, ...descartadas } }, nowMs);
      if (!next) break;
      combo = next;
      batch = await runBatch(combo, { budgetMs: deadline - now(), maxSites: cantidad, maxCandidates: candidatesLeft });
      candidatesLeft -= batch.examined || 0;
      (run.intentos ||= []).push({
        ciudad: combo.ciudad, rubro: combo.rubro.label,
        encontrados: batch.found ?? null, examinados: batch.examined ?? 0, conWeb: batch.results.length,
      });
      if (batch.status !== 'ok' || batch.results.length >= MIN_SITES_TO_PUBLISH) break;
      // Concluyente: Google se quedó sin negocios, o una corrida programada gastó todo su cupo.
      // Cortes por tiempo o por cupo reducido (modo rápido, 2º intento) no dicen nada de la combinación.
      if (!conclusivo(batch)) break;
      descartadas[comboKey(combo.ciudad, combo.rubro)] = nowMs;
    }

    if (!combo) {
      skipped = 'sin_combos';
    } else {
      run.combo = { ciudad: combo.ciudad, rubro: combo.rubro.label };
      run.auditados = batch.results.length;

      if (batch.status === 'error') {
        run.estado = 'error';
        run.error = batch.error || 'error desconocido';
      } else if (batch.status === 'cuota_agotada') {
        run.estado = 'cuota_agotada';
        if (batch.results.length >= MIN_SITES_TO_SAVE) {
          const stats = buildStats(batch.results);
          const saved = await saveReport(combo, batch.results, stats, nowMs, useGemini);
          run.auditoriaId = saved.id;
          markRan = true;
        }
      } else if (batch.results.length < MIN_SITES_TO_PUBLISH) {
        run.estado = 'sin_resultados';
        markRan = conclusivo(batch); // cortado por presupuesto: no se descarta la combinación
      } else {
        const stats = buildStats(batch.results);
        const saved = await saveReport(combo, batch.results, stats, nowMs, useGemini);
        run.auditoriaId = saved.id;
        markRan = true;

        const { payload } = buildPost({
          combo, stats, auditoriaId: saved.id, summary: saved.summary,
          networks: config.networks,
        });
        const image = await imageIsReachable(payload.imageUrl);
        if (!image.ok) {
          run.estado = 'post_fallido';
          run.error = `La captura del informe no responde con una imagen (Microlink): ${image.detail}`;
        } else try {
          await postToMakeSocial(payload, { timeoutMs: 10000 });
          run.estado = 'ok';
          const historia = await publishAuditStory(saved.id, payload.networks);
          if (historia) run.historia = historia;
        } catch (e) {
          run.estado = 'post_fallido';
          run.error = e.status ? `Make respondió ${e.status}` : e.message;
        }
      }
    }
  } catch (e) {
    run.estado = 'error';
    run.error = e.message;
  } finally {
    try {
      if (!skipped) {
        await db.collection(RUNS_COLLECTION).add({
          ...run, duracionMs: now() - nowMs, createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.error('[auto-audit] no se pudo registrar el run:', e.message);
    }
    const patch = { lock: { until: 0 } };
    const marcar = { ...descartadas };
    if (markRan && combo) marcar[comboKey(combo.ciudad, combo.rubro)] = nowMs;
    if (Object.keys(marcar).length) patch.ultimaCorrida = marcar;

    // Proteger la liberación del candado: reintentar una vez si falla
    let attempts = 0;
    while (attempts < 2) {
      try {
        await configRef.set(patch, { merge: true });
        break;
      } catch (e) {
        attempts++;
        if (attempts >= 2) {
          console.error('[auto-audit] no se pudo liberar el candado:', e.message);
          break;
        }
      }
    }
  }

  if (skipped) return { skipped };
  return run;
}
