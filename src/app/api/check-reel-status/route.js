export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl;
    const renderId = searchParams.get('renderId');

    if (!renderId) {
      return Response.json({ error: 'renderId is required' }, { status: 400 });
    }

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;
    if (!SHOTSTACK_API_KEY) {
      return Response.json({ error: 'Shotstack API key not configured' }, { status: 500 });
    }

    const response = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
      method: 'GET',
      headers: { 'x-api-key': SHOTSTACK_API_KEY },
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to check status', details: error }, { status: response.status });
    }

    const result = await response.json();
    return Response.json({
      status: result.response.status,
      videoUrl: result.response.url,
      renderId,
    });
  } catch (error) {
    return Response.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
