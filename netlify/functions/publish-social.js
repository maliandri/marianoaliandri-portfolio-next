// Netlify Function para publicar en redes sociales via Make.com
// Actúa como proxy para evitar problemas de CORS

export async function handler(event) {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const aiProvider = data.aiProvider || 'groq';

    // Usar el mismo webhook para ambos AIs (Make.com tiene límite de webhooks en plan gratuito)
    // El Router en Make.com decidirá qué AI usar basándose en data.aiProvider
    const webhookURL = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

    console.log(`🤖 Usando AI: ${aiProvider.toUpperCase()}`);
    console.log(`📡 Webhook: ${webhookURL}`);

    // Enviar datos a Make.com
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Make.com webhook failed: ${response.status}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Publicación enviada correctamente'
      })
    };

  } catch (error) {
    console.error('❌ Error en publish-social:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}
