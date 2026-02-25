export async function POST(request) {
  try {
    const { productName, price, productId } = await request.json();

    if (!productName) {
      return Response.json({ error: 'productName is required' }, { status: 400 });
    }

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;
    if (!SHOTSTACK_API_KEY) {
      return Response.json({ error: 'Shotstack API key not configured' }, { status: 500 });
    }

    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
    let backgroundVideoUrl = null;

    if (PEXELS_API_KEY) {
      try {
        const pexelsQueries = ['abstract', 'particles', 'neon', 'bokeh', 'sparkle', 'geometric', 'gradient', 'light'];
        const randomQuery = pexelsQueries[Math.floor(Math.random() * pexelsQueries.length)];
        const pexelsResponse = await fetch(`https://api.pexels.com/videos/search?query=${randomQuery}&orientation=portrait&per_page=15`, {
          headers: { Authorization: PEXELS_API_KEY },
        });
        if (pexelsResponse.ok) {
          const pexelsData = await pexelsResponse.json();
          if (pexelsData.videos?.length > 0) {
            const randomVideo = pexelsData.videos[Math.floor(Math.random() * pexelsData.videos.length)];
            const videoFile = randomVideo.video_files.find(f => f.height >= 1280 && f.width / f.height < 1) || randomVideo.video_files[0];
            backgroundVideoUrl = videoFile.link;
          }
        }
      } catch { /* ignore */ }
    }

    const transitionsIn = ['fade', 'slideLeft', 'slideRight', 'slideUp'];
    const transitionsOut = ['fade', 'slideLeft', 'slideRight', 'slideDown'];
    const effects = ['zoomIn', 'zoomOut', 'slideLeft', 'slideRight'];
    const randomTransitionIn = transitionsIn[Math.floor(Math.random() * transitionsIn.length)];
    const randomTransitionOut = transitionsOut[Math.floor(Math.random() * transitionsOut.length)];
    const randomEffect = effects[Math.floor(Math.random() * effects.length)];

    const musicTracks = [
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648049/hype-drill-music-438398.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648049/sweet-life-luxury-chill-438146.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648046/music-free-458044.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648045/for-p-453681.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648044/fresh-457883.mp3',
    ];
    const randomMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];

    const tracks = [];
    if (backgroundVideoUrl) {
      tracks.push({ clips: [{ asset: { type: 'video', src: backgroundVideoUrl }, start: 0, length: 30, fit: 'crop', opacity: 0.6, effect: randomEffect, transition: { in: randomTransitionIn, out: randomTransitionOut } }] });
    }

    const callbackUrl = `https://hook.us2.make.com/qcvtjdf5o81w8lu9vwx1v5arhsty3f28?productId=${productId}`;

    const videoConfig = {
      timeline: {
        background: '#000000',
        soundtrack: { src: randomMusic, effect: 'fadeInFadeOut', volume: 0.5 },
        tracks: tracks.concat([
          { clips: [
            { asset: { type: 'html', html: `<p>${productName}</p>`, css: 'p { font-family: Montserrat; font-size: 54px; color: #FFFFFF; font-weight: 900; text-align: center; text-shadow: 3px 3px 6px rgba(0,0,0,0.8); }', width: 1000, height: 200 }, start: 0, length: 6, fit: 'none', position: 'top', offset: { x: 0, y: -0.15 }, transition: { in: 'slideDown', out: 'fade' } },
            { asset: { type: 'html', html: `<p>${productName}</p>`, css: 'p { font-family: Montserrat; font-size: 54px; color: #FFFFFF; font-weight: 900; text-align: center; text-shadow: 3px 3px 6px rgba(0,0,0,0.8); }', width: 1000, height: 200 }, start: 24, length: 6, fit: 'none', position: 'top', offset: { x: 0, y: -0.15 }, transition: { in: 'slideDown', out: 'fade' } },
          ]},
          { clips: [
            { asset: { type: 'html', html: `<p>${price || 'Consultar precio'}</p>`, css: 'p { font-family: Montserrat; font-size: 48px; color: #FFFFFF; font-weight: 700; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }', width: 800, height: 150 }, start: 0, length: 6, fit: 'none', position: 'bottom', offset: { x: 0, y: 0.15 }, transition: { in: 'slideUp', out: 'fade' } },
            { asset: { type: 'html', html: `<p>${price || 'Consultar precio'}</p>`, css: 'p { font-family: Montserrat; font-size: 48px; color: #FF3333; font-weight: 700; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }', width: 800, height: 150 }, start: 24, length: 6, fit: 'none', position: 'bottom', offset: { x: 0, y: 0.15 }, transition: { in: 'slideUp', out: 'fade' } },
          ]},
          { clips: [{ asset: { type: 'html', html: '<p>marianoaliandri.com.ar</p>', css: 'p { font-family: Montserrat; font-size: 32px; color: #FFD700; font-weight: 600; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.9); }', width: 800, height: 100 }, start: 12, length: 6, fit: 'none', position: 'bottom', offset: { x: 0, y: 0.1 }, transition: { in: 'fade', out: 'fade' } }] },
        ]),
      },
      output: { format: 'mp4', resolution: '1080', aspectRatio: '9:16', fps: 30 },
      callback: callbackUrl,
    };

    const response = await fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SHOTSTACK_API_KEY },
      body: JSON.stringify(videoConfig),
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to generate video', details: error }, { status: response.status });
    }

    const result = await response.json();
    return Response.json({ success: true, renderId: result.response.id, message: 'Video generation started' });
  } catch (error) {
    return Response.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
