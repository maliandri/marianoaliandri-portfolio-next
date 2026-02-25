// Netlify Function para consultar el estado del video en Shotstack

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { renderId } = event.queryStringParameters;

    if (!renderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'renderId is required' })
      };
    }

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;

    if (!SHOTSTACK_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Shotstack API key not configured' })
      };
    }

    // Consultar estado del render
    // Usar stage (staging environment)
    const response = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
      method: 'GET',
      headers: {
        'x-api-key': SHOTSTACK_API_KEY
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Error consultando estado:', error);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'Failed to check status',
          details: error
        })
      };
    }

    const result = await response.json();
    const status = result.response.status;
    const url = result.response.url;

    console.log(`📊 Estado del render ${renderId}:`, status);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: status, // queued, rendering, done, failed
        videoUrl: url, // URL del video MP4 (solo cuando status = 'done')
        renderId: renderId
      })
    };

  } catch (error) {
    console.error('❌ Error en check-reel-status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}
