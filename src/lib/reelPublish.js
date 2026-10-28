// Publica un reel ya renderizado (colección `reels`): Instagram (REELS) y la página de Facebook
// (video_reels), directo con la Graph API y el token de página de las historias. Lo usan
// scripts/reel-publish.mjs (si la publicación automática está prendida) y el admin (botón Publicar).
import { FieldValue } from 'firebase-admin/firestore';
import { publishIgReel, publishFbReel } from '../../scripts/igStoryClient.mjs';
import { sendAlert } from '@/lib/alert';

export const REELS = 'reels';

export async function publicarReel(db, id, { ig = publishIgReel, fb = publishFbReel } = {}) {
  const ref = db.collection(REELS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No existe el reel ${id}`);
  const r = snap.data();
  const redes = {};
  for (const [nombre, fn] of [['instagram', ig], ['facebook', fb]]) {
    try {
      redes[nombre] = { ok: true, id: await fn(r.videoUrl, r.caption) };
    } catch (e) {
      redes[nombre] = { ok: false, error: e.message };
    }
  }
  const fallas = Object.entries(redes).filter(([, x]) => !x.ok);
  const error = fallas.map(([k, x]) => `${k}: ${x.error}`).join(' · ') || null;
  await ref.update({ estado: 'publicado', publicadoAtMs: Date.now(), publicadoAt: FieldValue.serverTimestamp(), redes, error });
  if (fallas.length) {
    await sendAlert({ key: `reel:post:${fallas.map(([k]) => k).join(',')}`, titulo: 'Reel: falló la publicación en una red', detalle: error, contexto: { reel: id } });
  }
  return { id, redes, error };
}
