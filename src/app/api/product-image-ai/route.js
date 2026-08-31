export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CLOUD_NAME = 'dlshym1te';
const UPLOAD_PRESET = 'zone_analysis_images'; // preset unsigned existente

// Genera una ilustración del producto con Gemini (image), la sube a Cloudinary
// y guarda la URL en products/{id}.image.
export async function POST(request) {
  try {
    const { adminPassword, id, name = '', description = '' } = await request.json();
    if (adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!id) return Response.json({ error: 'Falta el ID del producto' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

    const prompt = `Ilustración digital moderna y profesional para la portada de un servicio de tecnología llamado "${name}". ${description}
Estilo: flat/isométrico limpio, colores vibrantes (violeta, azul, índigo), fondo simple, sin texto, sin logos, sin marcas de agua. Composición centrada, apta para card de e-commerce. Relación de aspecto horizontal.`;

    const genRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!genRes.ok) {
      const err = await genRes.text();
      return Response.json({ error: `Gemini image error ${genRes.status}: ${err}` }, { status: 502 });
    }

    const genData = await genRes.json();
    const parts = genData?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imgPart?.inlineData || imgPart?.inline_data;
    if (!inline?.data) {
      return Response.json({ error: 'Gemini no devolvió imagen', detail: genData?.candidates?.[0]?.finishReason }, { status: 502 });
    }
    const mime = inline.mimeType || inline.mime_type || 'image/png';
    const dataUri = `data:${mime};base64,${inline.data}`;

    // Subir a Cloudinary (unsigned)
    const form = new FormData();
    form.append('file', dataUri);
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', 'store-products');
    form.append('public_id', `product-${id}-${Date.now()}`);

    const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });
    const upData = await upRes.json();
    if (!upRes.ok || !upData.secure_url) {
      return Response.json({ error: 'Error subiendo a Cloudinary', detail: upData?.error?.message }, { status: 502 });
    }

    const imageUrl = upData.secure_url;

    // Guardar en el producto
    try {
      const db = getDb();
      await db.collection('products').doc(id).set(
        { image: imageUrl, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      // si falla el guardado, igual devolvemos la URL para que el admin la vea
      return Response.json({ imageUrl, warning: 'Imagen generada pero no se pudo guardar: ' + e.message });
    }

    return Response.json({ success: true, imageUrl });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
