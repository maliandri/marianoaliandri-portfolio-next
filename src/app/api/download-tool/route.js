export const dynamic = 'force-dynamic';

import admin, { getDb } from '../../../lib/firebase-admin';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return Response.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    const body = await request.json();
    const { toolId } = body;

    const TOOLS = {
      'navaja-suiza': {
        name: 'Navaja Suiza by Maliandri',
        version: '1.0.0',
        url: process.env.NAVAJA_SUIZA_DOWNLOAD_URL,
      },
    };

    const tool = TOOLS[toolId];
    if (!tool) {
      return Response.json({ error: 'Herramienta no encontrada' }, { status: 404 });
    }
    if (!tool.url) {
      return Response.json({ error: 'Descarga no disponible aún' }, { status: 503 });
    }

    // Registrar descarga en Firestore
    const db = getDb();
    if (db) {
      await db.collection('tool_downloads').add({
        toolId,
        toolVersion: tool.version,
        toolName: tool.name,
        userId: decoded.uid,
        email: decoded.email || '',
        displayName: decoded.name || '',
        downloadedAt: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: request.headers.get('user-agent') || '',
      });
    }

    return Response.json({ url: tool.url });
  } catch (error) {
    console.error('download-tool error:', error);
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
