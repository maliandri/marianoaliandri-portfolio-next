import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CIUDADES_SEMILLA, RUBROS_SEMILLA, IMAGEN_MARCA } from '@/data/auditoriaAuto';
import { pickNext, comboKey, buildStats, buildPost, DEFAULT_NETWORKS } from '@/lib/autoAudit';
import { runBatch } from '@/lib/autoAuditBatch';
import { saveAuditoria } from '@/lib/auditoriasStore';

const CONFIG_COLLECTION = 'auditoria_auto';
const RUNS_COLLECTION = 'auditoria_auto_runs';
const LOCK_MS = 15 * 60 * 1000;          // un candado huérfano vence solo a los 15 min
const MIN_SITES_TO_SAVE = 5;             // con cuota agotada solo se guarda si hay al menos 5
const MAKE_WEBHOOK_DEFAULT = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

export function defaultConfig() {
  return {
    activo: false, // arranca apagada: se activa desde el admin tras probar con "Correr ahora"
    ciudades: [...CIUDADES_SEMILLA],
    rubros: RUBROS_SEMILLA.map(r => ({ ...r })),
    networks: [...DEFAULT_NETWORKS],
    imageUrl: IMAGEN_MARCA,
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
    imageUrl: d.imageUrl || base.imageUrl,
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
  const config = { ciudades: [combo.ciudad], pais: 'Argentina', radioKm: 15, tiposLabels: [combo.rubro.label] };
  return saveAuditoria({ title, config, results, stats, useGemini });
}

// Make responde 200 antes de correr el escenario: un imageUrl roto pasaría como 'ok'.
// Verifica que la URL responda 2xx con content-type image/* (HEAD, y GET si el host rechaza HEAD).
const imageCheck = { detail: '' };
async function imageIsReachable(url) {
  imageCheck.detail = '';
  try {
    for (const method of ['HEAD', 'GET']) {
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(8000) });
      const type = res.headers?.get?.('content-type') || '';
      if (method === 'GET') res.body?.cancel?.();
      if (res.ok && type.startsWith('image/')) return true;
      imageCheck.detail = res.ok ? `content-type ${type || 'vacío'}` : `HTTP ${res.status}`;
    }
    return false;
  } catch (e) {
    imageCheck.detail = e.message;
    return false;
  }
}

// Una corrida de la auditoría automática. La invocan el script de GitHub Actions
// (scripts/auto-audit.mjs) y el botón "Correr ahora" del admin (force: true).
export async function runAutoAudit({
  force = false, now = Date.now, budgetMs = 45000, maxSites = 15, maxCandidates = 40, useGemini = true,
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

  try {
    combo = pickNext(config, nowMs);
    if (!combo) {
      skipped = 'sin_combos';
    } else {
      run.combo = { ciudad: combo.ciudad, rubro: combo.rubro.label };
      const batch = await runBatch(combo, { budgetMs, maxSites, maxCandidates });
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
      } else if (!batch.results.length) {
        run.estado = 'sin_resultados';
        markRan = true;
      } else {
        const stats = buildStats(batch.results);
        const saved = await saveReport(combo, batch.results, stats, nowMs, useGemini);
        run.auditoriaId = saved.id;
        markRan = true;

        const { payload } = buildPost({
          combo, stats, auditoriaId: saved.id, summary: saved.summary,
          imageUrl: config.imageUrl, networks: config.networks,
        });
        if (!(await imageIsReachable(config.imageUrl))) {
          run.estado = 'post_fallido';
          run.error = `imageUrl no responde con una imagen (revisar config.imageUrl): ${imageCheck.detail}`;
        } else try {
          const res = await fetch(process.env.MAKE_SOCIAL_WEBHOOK_URL || MAKE_WEBHOOK_DEFAULT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            run.estado = 'ok';
          } else {
            run.estado = 'post_fallido';
            run.error = `Make respondió ${res.status}`;
          }
        } catch (e) {
          run.estado = 'post_fallido';
          run.error = e.message;
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
    if (markRan && combo) patch.ultimaCorrida = { [comboKey(combo.ciudad, combo.rubro)]: nowMs };

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
