export async function POST(request) {
  try {
    const data = await request.json();
    const webhookURL = 'https://hook.us2.make.com/qcvtjdf5o81w8lu9vwx1v5arhsty3f28';

    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Make.com webhook failed: ${response.status}`);
    }

    return Response.json({ success: true, message: 'Publicación enviada correctamente' });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
