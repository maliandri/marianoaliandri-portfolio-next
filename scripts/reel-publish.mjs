// Reels automáticos, paso 3 de 3: sube video/out/reel.mp4 a Cloudinary, lo guarda en `reels` (borrador)
// y marca la fuente como usada. Si la publicación automática está prendida (reels_config.activo), además
// lo publica en Instagram, Facebook y LinkedIn. Si no, queda para revisar y publicar desde el admin.
// Se ejecuta con: npx tsx --tsconfig jsconfig.json scripts/reel-publish.mjs
import fs from 'node:fs';
import path from 'node:path';

const { getDb } = await import('../src/lib/firebase-admin.js');
const { FieldValue } = await import('firebase-admin/firestore');
const { uploadVideo } = await import('../src/lib/cloudinaryServer.js');
const { publicarReel, REELS } = await import('../src/lib/reelPublish.js');
const { sendAlert } = await import('../src/lib/alert.js');

const metaPath = path.resolve('video', 'reel-meta.json');
const mp4Path = path.resolve('video', 'out', 'reel.mp4');
if (!fs.existsSync(metaPath) || !fs.existsSync(mp4Path)) { console.log('[reel] no hay reel para subir'); process.exit(0); }

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const db = getDb();
try {
  const bytes = fs.readFileSync(mp4Path);
  console.log(`[reel] subiendo ${(bytes.length / 1048576).toFixed(1)} MB`);
  const videoUrl = await uploadVideo(bytes, 'reels');
  const ref = await db.collection(REELS).add({
    tipo: meta.tipo, titulo: meta.titulo, caption: meta.caption, fuente: meta.fuente, duracion: meta.duracion,
    videoUrl, estado: 'borrador', createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp(),
  });
  if (meta.fuente?.id) await db.collection(meta.fuente.coleccion).doc(meta.fuente.id).update({ reelId: ref.id }).catch(() => {});
  const cfg = (await db.collection('reels_config').doc('settings').get()).data() || {};
  if (cfg.activo === true) {
    const r = await publicarReel(db, ref.id);
    console.log('[reel] publicado', JSON.stringify(r.redes));
  } else {
    console.log(`[reel] guardado como borrador ${ref.id} (publicación automática apagada)`);
  }
  process.exit(0);
} catch (e) {
  console.error('[reel] error:', e.message);
  await sendAlert({ key: 'reel:error', titulo: 'Reel automático: no se pudo subir o guardar', detalle: e.message });
  process.exit(1);
}
