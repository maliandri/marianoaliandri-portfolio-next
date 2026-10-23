export const dynamic = 'force-dynamic';

// Seguimiento de prospectos de Instagram (admin). Colección ig_prospectos/{handle}, solo Admin SDK.
// GET → lista · POST { lead, regenerar? } → crea/actualiza y genera el DM · PATCH { handle, estado?, dm?, notas? }
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminAuth';
import { callGemini } from '@/lib/geminiClient';
import { ESTADO_IDS, prospectoFromLead, buildDmPrompt, dmTemplate, cleanDm, MAX_DM_CHARS } from '@/lib/igProspectos';

const COL = 'ig_prospectos';
const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

const toIso = (ts) => (ts?.toDate ? ts.toDate().toISOString() : ts || null);
const serialize = (d) => {
  const x = d.data();
  return { ...x, createdAt: toIso(x.createdAt), updatedAt: toIso(x.updatedAt), contactadoAt: toIso(x.contactadoAt) };
};

export async function GET(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const snap = await getDb().collection(COL).orderBy('updatedAt', 'desc').limit(500).get();
  return Response.json({ items: snap.docs.map(serialize) });
}

export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { lead, regenerar = false } = await request.json().catch(() => ({}));
  const handle = String(lead?.instagram || '').toLowerCase();
  if (!HANDLE_RE.test(handle)) return Response.json({ error: 'Instagram inválido' }, { status: 400 });

  const ref = getDb().collection(COL).doc(handle);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  if (prev?.dm && !regenerar) return Response.json({ item: serialize(snap) });

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

  return Response.json({ item: serialize(await ref.get()) });
}

export async function PATCH(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const { handle, estado, dm, notas } = await request.json().catch(() => ({}));
  if (!HANDLE_RE.test(String(handle || ''))) return Response.json({ error: 'Instagram inválido' }, { status: 400 });
  if (estado !== undefined && !ESTADO_IDS.includes(estado)) return Response.json({ error: 'Estado inválido' }, { status: 400 });

  const ref = getDb().collection(COL).doc(handle);
  if (!(await ref.get()).exists) return Response.json({ error: 'No existe' }, { status: 404 });

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (estado !== undefined) {
    patch.estado = estado;
    if (estado === 'contactado') patch.contactadoAt = FieldValue.serverTimestamp();
  }
  if (typeof dm === 'string') patch.dm = dm.slice(0, MAX_DM_CHARS * 2);
  if (typeof notas === 'string') patch.notas = notas.slice(0, 2000);

  await ref.update(patch);
  return Response.json({ item: serialize(await ref.get()) });
}
