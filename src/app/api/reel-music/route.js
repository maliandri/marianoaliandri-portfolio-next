export const dynamic = 'force-dynamic';

const MUSIC_BASE = 'https://res.cloudinary.com/dlshym1te/video/upload';

const FALLBACK_TRACKS = {
  upbeat:        `${MUSIC_BASE}/v1767648045/for-p-453681.mp3`,
  chill:         `${MUSIC_BASE}/v1767648049/sweet-life-luxury-chill-438146.mp3`,
  corporate:     `${MUSIC_BASE}/v1767648049/hype-drill-music-438398.mp3`,
  inspirational: `${MUSIC_BASE}/v1767648046/music-free-458044.mp3`,
  tech:          `${MUSIC_BASE}/v1767648044/fresh-457883.mp3`,
};

export async function POST(request) {
  try {
    const { mood = 'upbeat' } = await request.json();

    const apiKey = process.env.MUBERT_API_KEY;

    if (apiKey) {
      try {
        const mubertRes = await fetch('https://api.mubert.com/v2/TTM', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'RecordTrackTTM',
            params: {
              pat: apiKey,
              tags: mood,
              duration: 35,
              format: 'mp3',
              intensity: 'medium',
            },
          }),
        });

        if (mubertRes.ok) {
          const mubertData = await mubertRes.json();
          const musicUrl = mubertData?.data?.tasks?.[0]?.download_link;
          if (musicUrl) return Response.json({ musicUrl });
        }
      } catch {
        // fallback
      }
    }

    // Fallback a tracks de Cloudinary
    const musicUrl = FALLBACK_TRACKS[mood] || FALLBACK_TRACKS.upbeat;
    return Response.json({ musicUrl });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
