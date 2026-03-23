export const dynamic = 'force-dynamic';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
const UPLOAD_PRESET = 'Marian';
const MAKE_WEBHOOK = 'https://hook.us2.make.com/qcvtjdf5o81w8lu9vwx1v5arhsty3f28';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const videoBlob = formData.get('video');
    const productId = formData.get('productId') || 'reel';

    if (!videoBlob) {
      return Response.json({ error: 'No video provided' }, { status: 400 });
    }

    // Re-armamos el FormData para Cloudinary
    const cloudinaryForm = new FormData();
    cloudinaryForm.append('file', videoBlob);
    cloudinaryForm.append('upload_preset', UPLOAD_PRESET);
    cloudinaryForm.append('folder', 'reels');
    cloudinaryForm.append('resource_type', 'video');

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      { method: 'POST', body: cloudinaryForm }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return Response.json({ error: 'Cloudinary upload failed', details: err }, { status: 502 });
    }

    const { secure_url: videoUrl } = await uploadRes.json();

    // Notificar Make.com (no bloquear si falla)
    fetch(`${MAKE_WEBHOOK}?productId=${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, productId, type: 'reel' }),
    }).catch(() => {});

    return Response.json({ success: true, videoUrl });
  } catch (error) {
    return Response.json({ error: 'Internal error', message: error.message }, { status: 500 });
  }
}
