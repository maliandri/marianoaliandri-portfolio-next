export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { nombre, telefono, email, sitioWeb, searchTerm, provincia, localidad } = await request.json();

    if (!nombre || !telefono || !email || !searchTerm || !provincia || !localidad) {
      return Response.json({ error: 'Completá todos los campos requeridos' }, { status: 400 });
    }

    const ref = await db.collection('audit_requests').add({
      nombre,
      telefono,
      email,
      sitioWeb:   sitioWeb   || null,
      searchTerm,
      provincia,
      localidad,
      status:    'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Email de confirmación al solicitante
    await resend.emails.send({
      from:    'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>',
      replyTo: 'marianoaliandri@gmail.com',
      to:      email,
      subject: `✅ Recibimos tu solicitud de auditoría — ${searchTerm} en ${localidad}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#312e81,#1e1b4b);padding:32px 28px;">
            <p style="color:#a5b4fc;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">Auditoría web gratuita</p>
            <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">¡Solicitud recibida, ${nombre.split(' ')[0]}!</h1>
          </div>
          <div style="padding:28px;">
            <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 20px;">
              Registramos tu solicitud de auditoría. Vamos a analizar cómo aparece
              <strong style="color:#e5e5e5;">${searchTerm}</strong> en Google para la zona de
              <strong style="color:#e5e5e5;">${localidad}, ${provincia}</strong>.
            </p>

            <div style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <p style="color:#6366f1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">Resumen de tu solicitud</p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr><td style="color:#9ca3af;padding:4px 0;width:120px;">Nombre</td><td style="color:#e5e5e5;">${nombre}</td></tr>
                <tr><td style="color:#9ca3af;padding:4px 0;">Teléfono</td><td style="color:#e5e5e5;">${telefono}</td></tr>
                <tr><td style="color:#9ca3af;padding:4px 0;">Rubro</td><td style="color:#e5e5e5;">${searchTerm}</td></tr>
                <tr><td style="color:#9ca3af;padding:4px 0;">Ciudad</td><td style="color:#e5e5e5;">${localidad}, ${provincia}</td></tr>
                ${sitioWeb ? `<tr><td style="color:#9ca3af;padding:4px 0;">Sitio web</td><td style="color:#e5e5e5;">${sitioWeb}</td></tr>` : ''}
              </table>
            </div>

            <p style="color:#9ca3af;font-size:13px;margin:0 0 24px;">
              Te contactamos en las próximas <strong style="color:#e5e5e5;">48 horas</strong> a este email o por WhatsApp al ${telefono}.
            </p>

            <a href="https://marianoaliandri.com.ar" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;">Ver portfolio completo →</a>
          </div>
          <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:#6b7280;font-size:11px;margin:0;">Mariano Aliandri — Desarrollo Web & SEO · marianoaliandri.com.ar</p>
          </div>
        </div>
      `,
    });

    // Notificación al admin
    await resend.emails.send({
      from:    'Sistema <notificaciones@marianoaliandri.com.ar>',
      to:      'marianoaliandri@gmail.com',
      subject: `📋 Nueva solicitud de auditoría — ${searchTerm} en ${localidad}`,
      html: `
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Teléfono:</strong> ${telefono}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Rubro:</strong> ${searchTerm}</p>
        <p><strong>Ciudad:</strong> ${localidad}, ${provincia}</p>
        ${sitioWeb ? `<p><strong>Sitio:</strong> ${sitioWeb}</p>` : ''}
        <p><strong>ID:</strong> ${ref.id}</p>
      `,
    });

    console.log('[audit-request] nueva solicitud:', ref.id, email);
    return Response.json({ success: true, id: ref.id });

  } catch (e) {
    console.error('[audit-request] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const snap = await db.collection('audit_requests').orderBy('createdAt', 'desc').limit(200).get();
    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
    }));
    return Response.json(items);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const { id, status } = await request.json();
    if (!id || !status) return Response.json({ error: 'Faltan campos' }, { status: 400 });
    await db.collection('audit_requests').doc(id).update({ status });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
