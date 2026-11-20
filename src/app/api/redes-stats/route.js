export const dynamic = 'force-dynamic';

// Métricas de redes para el admin: Instagram (Graph API) y LinkedIn (lo publicado desde el sitio).
// GET → { instagram, linkedin }. Cada red falla por separado y devuelve `error` sin tirar la otra.
// La lógica vive en src/lib/socialStats.js (compartida con las tools del servidor MCP).
import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { igCredsFromEnv } from '../../../../scripts/igStoryClient.mjs';
import { linkedinExpiry } from '@/lib/linkedinClient';
import { fetchInstagramStats, listLinkedInPosts, snapshotSeguidores } from '@/lib/socialStats';

async function instagram(db, days) {
  try {
    const r = await fetchInstagramStats({ creds: igCredsFromEnv(), days, posts: 25 });
    const evolucion = await snapshotSeguidores(db, 'instagram', r.perfil.seguidores);
    return { ...r, evolucion };
  } catch (e) {
    return { error: e?.message || 'No se pudo leer Instagram.' };
  }
}

async function linkedin(db, days) {
  try {
    const now = Date.now();
    const [posts, exp] = await Promise.all([
      listLinkedInPosts(db, { dias: days, limit: 50, now }),
      linkedinExpiry(db, now),
    ]);
    const conexion = !exp ? { conectado: false }
      : { conectado: exp.dias >= 0, diasRestantes: Number.isFinite(exp.dias) ? exp.dias : null };
    return { posts: posts.items, fallidos: posts.fallidos, conexion };
  } catch (e) {
    return { error: e?.message || 'No se pudo leer LinkedIn.' };
  }
}

export async function GET(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
  const dias = new URL(request.url).searchParams.get('days') === '7' ? 7 : 28;
  const [ig, li] = await Promise.all([instagram(db, dias), linkedin(db, dias)]);
  return Response.json({ dias, instagram: ig, linkedin: li });
}
