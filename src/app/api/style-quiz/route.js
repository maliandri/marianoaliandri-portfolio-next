export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, likedStyles, features, comment } = body;

    if (!name || (!email && !phone)) {
      return Response.json({ error: 'Falta nombre y un email o teléfono de contacto' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'Error de base de datos' }, { status: 500 });

    const docRef = await db.collection('style_quiz_responses').add({
      name,
      email: email || '',
      phone: phone || '',
      likedStyles: Array.isArray(likedStyles) ? likedStyles : [],
      features: Array.isArray(features) ? features : [],
      comment: comment || '',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Notificar al admin por email
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://marianoaliandri.com.ar'}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'style-quiz-received',
          name,
          email,
          phone,
          likedStyles,
          features,
          comment,
        }),
      });
    } catch {
      // No bloquear si el email falla
    }

    return Response.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('style-quiz POST error:', error);
    return Response.json({ error: 'Error al guardar la respuesta' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'Error de base de datos' }, { status: 500 });

    const snap = await db.collection('style_quiz_responses').orderBy('createdAt', 'desc').limit(100).get();
    const responses = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json(responses);
  } catch (error) {
    console.error('style-quiz GET error:', error);
    return Response.json({ error: 'Error al obtener respuestas' }, { status: 500 });
  }
}
