// Publica un reel ya renderizado (colección `reels`): Instagram (REELS) y la página de Facebook
// (video_reels), directo con la Graph API y el token de página de las historias, y LinkedIn como video
// nativo (API de LinkedIn, conexión del admin). Lo usan scripts/reel-publish.mjs (si la publicación
// automática está prendida) y el admin (botón Publicar / reintentar).
// Solo publica en las redes donde todavía no salió: reintentar no duplica los posts que ya están.
import { FieldValue } from 'firebase-admin/firestore';
import { publishIgReel, publishFbReel } from '../../scripts/igStoryClient.mjs';
import { getLinkedInAuth, publishVideoPost } from '@/lib/linkedinClient';
import { sendAlert } from '@/lib/alert';

export const REELS = 'reels';
export const REDES_REEL = ['instagram', 'facebook', 'linkedin'];
const NOMBRE = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };

async function linkedinReel(db, r) {
  const { token, author } = await getLinkedInAuth(db);
  const res = await fetch(r.videoUrl, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`No se pudo bajar el video (${res.status})`);
  const video = Buffer.from(await res.arrayBuffer());
  return publishVideoPost({ token, author, video, title: r.titulo, text: r.caption });
}

export async function publicarReel(db, id, {
  redes: pedidas = REDES_REEL,
  ig = publishIgReel,
  fb = publishFbReel,
  li = (r) => linkedinReel(db, r),
} = {}) {
  const ref = db.collection(REELS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No existe el reel ${id}`);
  const r = snap.data();
  const redes = { ...(r.redes || {}) };
  const fns = { instagram: () => ig(r.videoUrl, r.caption), facebook: () => fb(r.videoUrl, r.caption), linkedin: () => li(r) };
  for (const red of pedidas.filter(x => fns[x] && !redes[x]?.ok)) {
    try {
      redes[red] = { ok: true, id: await fns[red]() };
    } catch (e) {
      redes[red] = { ok: false, error: e.message };
    }
  }
  const fallas = Object.entries(redes).filter(([, x]) => !x.ok);
  const error = fallas.map(([k, x]) => `${NOMBRE[k] || k}: ${x.error}`).join(' · ') || null;
  await ref.update({ estado: 'publicado', publicadoAtMs: Date.now(), publicadoAt: FieldValue.serverTimestamp(), redes, error });
  if (fallas.length) {
    await sendAlert({ key: `reel:post:${fallas.map(([k]) => k).join(',')}`, titulo: 'Reel: falló la publicación en una red', detalle: error, contexto: { reel: id } });
  }
  return { id, redes, error };
}
