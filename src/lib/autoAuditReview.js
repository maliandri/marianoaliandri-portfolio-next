// Revisión de los lotes de la auditoría automática: con revision: true la corrida deja un borrador
// en auditoria_auto_borradores y nada es público hasta aprobarlo. Lo usan el admin
// (/api/auditoria-auto/borradores/) y el MCP (list_audit_drafts / review_audit_draft).
import { FieldValue } from 'firebase-admin/firestore';
import { DRAFTS_COLLECTION, MIN_SITES_TO_PUBLISH, publicarInforme, loadConfig } from '@/lib/autoAuditRun';
import { enviarMailsAuditoria } from '@/lib/autoAuditEmail';
import { buildStats } from '@/lib/autoAudit';

const CLAIM_MS = 5 * 60 * 1000; // una aprobación colgada (se cayó a mitad) se puede retomar a los 5 min
const toIso = (t) => t?.toDate?.()?.toISOString() || null;

export class ReviewError extends Error {}

// Vista de un borrador para el admin y el MCP (sin campos internos).
export function borradorView(id, d) {
  return {
    id,
    estado: d.estado,
    ciudad: d.combo?.ciudad || null,
    localidades: d.combo?.ciudades || [],
    rubro: d.combo?.rubro?.label || null,
    stats: d.stats || buildStats(d.results || []),
    busqueda: d.busqueda || null,
    networks: d.networks || [],
    results: d.results || [],
    creado: toIso(d.createdAt) || (d.creadoMs ? new Date(d.creadoMs).toISOString() : null),
    auditoriaId: d.auditoriaId || null,
    excluidos: d.excluidos || [],
    resultado: d.resultado || null,
    motivo: d.motivo || null,
  };
}

export async function listarBorradores(db, { estado = 'pendiente', limit = 20 } = {}) {
  // Colección chica: se filtra el estado en memoria (evita un índice compuesto).
  const snap = await db.collection(DRAFTS_COLLECTION).orderBy('createdAt', 'desc').limit(100).get();
  return snap.docs
    .filter(d => estado === 'todos' || d.data().estado === estado)
    .slice(0, limit)
    .map(d => borradorView(d.id, d.data()));
}

export async function getBorrador(db, id) {
  if (typeof id !== 'string' || !id || id.includes('/')) throw new ReviewError('Id de borrador inválido.');
  const snap = await db.collection(DRAFTS_COLLECTION).doc(id).get();
  if (!snap.exists) throw new ReviewError('No existe ese borrador.');
  return borradorView(snap.id, snap.data());
}

// Aprueba: guarda el informe público (sin los sitios excluidos) y, si redes, lo anuncia como lo hacía
// la corrida directa. dryRun: solo dice qué saldría.
export async function aprobarBorrador(db, id, {
  redes = true, networks, excluir = [], useGemini = true, dryRun = false, now = Date.now,
} = {}) {
  const b = await getBorrador(db, id);
  if (b.estado !== 'pendiente' && b.estado !== 'aprobando') throw new ReviewError(`Este borrador ya está ${b.estado}.`);
  const fuera = new Set(excluir);
  const results = b.results.filter(r => !fuera.has(r.id));
  if (results.length < MIN_SITES_TO_PUBLISH) {
    throw new ReviewError(`Quedan ${results.length} sitios; hacen falta al menos ${MIN_SITES_TO_PUBLISH} para publicar el informe.`);
  }
  const redesFinal = networks?.length ? networks : b.networks;
  if (dryRun) {
    return { dryRun: true, sitios: results.length, excluidos: [...fuera].filter(x => b.results.some(r => r.id === x)), stats: buildStats(results), redes: redes ? redesFinal : [] };
  }

  const ref = db.collection(DRAFTS_COLLECTION).doc(id);
  const nowMs = now();
  const claim = await db.runTransaction(async tx => {
    const x = (await tx.get(ref)).data() || {};
    if (x.estado === 'aprobando' && nowMs - (x.aprobandoMs || 0) < CLAIM_MS) return 'en_curso';
    if (x.estado !== 'pendiente' && x.estado !== 'aprobando') return x.estado;
    tx.update(ref, { estado: 'aprobando', aprobandoMs: nowMs });
    return 'ok';
  });
  if (claim === 'en_curso') throw new ReviewError('Este borrador se está aprobando ahora mismo; esperá un minuto.');
  if (claim !== 'ok') throw new ReviewError(`Este borrador ya está ${claim}.`);

  const raw = (await ref.get()).data();
  let resultado;
  try {
    resultado = await publicarInforme({
      combo: { ciudad: raw.combo.ciudad, ciudades: raw.combo.ciudades, rubro: raw.combo.rubro },
      results, nowMs: raw.creadoMs || nowMs, useGemini, networks: redesFinal, redes,
    });
  } catch (e) {
    await ref.update({ estado: 'pendiente', aprobandoMs: FieldValue.delete() });
    throw e;
  }
  // Mails a los negocios (si están prendidos), igual que cuando la corrida publica directo.
  let mails = null;
  if (resultado.auditoriaId) {
    try {
      const config = await loadConfig(db);
      if (config.emailAuto) {
        mails = await enviarMailsAuditoria(db, {
          combo: { ciudad: raw.combo.ciudad, rubro: raw.combo.rubro }, results, auditoriaId: resultado.auditoriaId,
          config, configRef: db.collection('auditoria_auto').doc('config'),
        });
      }
    } catch (e) {
      console.error('[auto-audit] mails tras aprobar:', e.message);
    }
  }
  await ref.update({
    estado: 'publicado', auditoriaId: resultado.auditoriaId, excluidos: [...fuera],
    resultado: { estado: resultado.estado, error: resultado.error || null, redes: redes ? redesFinal : [], historia: resultado.historia || null, mails },
    aprobadoEn: FieldValue.serverTimestamp(), aprobandoMs: FieldValue.delete(),
  });
  return { ...resultado, sitios: results.length, ...(mails ? { mails } : {}) };
}

export async function descartarBorrador(db, id, motivo = '') {
  const b = await getBorrador(db, id);
  if (b.estado !== 'pendiente') throw new ReviewError(`Este borrador ya está ${b.estado}.`);
  await db.collection(DRAFTS_COLLECTION).doc(id).update({
    estado: 'descartado', motivo: String(motivo || '').slice(0, 500) || null, descartadoEn: FieldValue.serverTimestamp(),
  });
  return { id, estado: 'descartado' };
}
