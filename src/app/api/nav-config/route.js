export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const VALID_TREES = ['admin', 'client'];

// GET pública (el panel del cliente necesita leer su propio árbol sin ser admin).
// Si no hay config guardada todavía, devuelve null -- el caller usa su default hardcodeado.
export async function GET(request) {
  try {
    const tree = new URL(request.url).searchParams.get('tree');
    if (!VALID_TREES.includes(tree)) return Response.json({ error: 'tree inválido (admin|client)' }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ sections: null });

    const snap = await db.collection('nav_config').doc(tree).get();
    if (!snap.exists) return Response.json({ sections: null });

    const data = snap.data();
    return Response.json({ sections: data.sections || null, updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null });
  } catch (error) {
    return Response.json({ error: 'Error leyendo configuración', details: error.message }, { status: 500 });
  }
}

// POST admin-only — reemplaza el árbol completo de una vez (mismo patrón que leadfinder_plans).
export async function POST(request) {
  try {
    const { adminPassword, tree, sections } = await request.json();
    if (adminPassword !== ADMIN_PASSWORD || !ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!VALID_TREES.includes(tree)) return Response.json({ error: 'tree inválido (admin|client)' }, { status: 400 });
    if (!Array.isArray(sections)) return Response.json({ error: 'sections debe ser un array' }, { status: 400 });

    const db = getDb();
    await db.collection('nav_config').doc(tree).set(
      { sections, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: false }
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Error guardando configuración', details: error.message }, { status: 500 });
  }
}
