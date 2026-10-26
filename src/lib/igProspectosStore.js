import { FieldValue } from 'firebase-admin/firestore';
import { callGemini } from '@/lib/geminiClient';
import { ESTADO_IDS, prospectoFromLead, buildDmPrompt, dmTemplate, cleanDm, MAX_DM_CHARS } from '@/lib/igProspectos';

// Seguimiento de prospectos de Instagram. Colección ig_prospectos/{handle}, solo Admin SDK.
// Lo usan /api/ig-prospectos (admin) y el servidor MCP. Nada de esto manda mensajes a Instagram.

const COL = 'ig_prospectos';
export const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

const toIso = (ts) => (ts?.toDate ? ts.toDate().toISOString() : ts || null);
export const serialize = (d) => {
  const x = d.data();
  return { ...x, createdAt: toIso(x.createdAt), updatedAt: toIso(x.updatedAt), contactadoAt: toIso(x.contactadoAt) };
};

// Más recientes primero. `cursor` = updatedAt ISO del último ítem de la página anterior.
export async function listProspectos(db, { estado, limit = 20, cursor = null } = {}) {
  let q = db.collection(COL);
  if (estado) q = q.where('estado', '==', estado);
  q = q.orderBy('updatedAt', 'desc');
  if (cursor) q = q.startAfter(new Date(cursor));
  const snap = await q.limit(limit + 1).get();
  const items = snap.docs.slice(0, limit).map(serialize);
  return { items, nextCursor: snap.docs.length > limit ? items.at(-1).updatedAt : null };
}

// Crea o actualiza el prospecto y genera el DM (Gemini, con plantilla de respaldo).
export async function upsertProspecto(db, lead, { regenerar = false } = {}) {
  const handle = String(lead?.instagram || '').toLowerCase();
  if (!HANDLE_RE.test(handle)) return { error: 'Instagram inválido', status: 400 };

  const ref = db.collection(COL).doc(handle);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  if (prev?.dm && !regenerar) return { item: serialize(snap) };

  let dm, dmSource = 'gemini';
  try {
    dm = cleanDm(await callGemini(buildDmPrompt({ ...lead, instagram: handle })));
  } catch (e) {
    console.warn('[ig-prospectos] Gemini no disponible, uso plantilla:', e.message);
  }
  if (!dm) { dm = dmTemplate(lead); dmSource = 'plantilla'; }

  await ref.set({
    ...prospectoFromLead({ ...lead, instagram: handle }),
    dm, dmSource,
    estado: prev?.estado || 'pendiente',
    ...(prev ? {} : { createdAt: FieldValue.serverTimestamp() }),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { item: serialize(await ref.get()) };
}

export async function updateProspecto(db, handle, { estado, dm, notas } = {}) {
  if (!HANDLE_RE.test(String(handle || ''))) return { error: 'Instagram inválido', status: 400 };
  if (estado !== undefined && !ESTADO_IDS.includes(estado)) return { error: 'Estado inválido', status: 400 };

  const ref = db.collection(COL).doc(handle);
  if (!(await ref.get()).exists) return { error: 'No existe', status: 404 };

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (estado !== undefined) {
    patch.estado = estado;
    if (estado === 'contactado') patch.contactadoAt = FieldValue.serverTimestamp();
  }
  if (typeof dm === 'string') patch.dm = dm.slice(0, MAX_DM_CHARS * 2);
  if (typeof notas === 'string') patch.notas = notas.slice(0, 2000);

  await ref.update(patch);
  return { item: serialize(await ref.get()) };
}
