// Netlify Function para generar videos con Shotstack - VERSIÓN MEJORADA

export async function handler(event) {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { productName, price, productId } = JSON.parse(event.body);

    if (!productName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'productName is required' })
      };
    }

    const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;

    if (!SHOTSTACK_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Shotstack API key not configured' })
      };
    }

    console.log('🔑 API Key presente:', SHOTSTACK_API_KEY ? `Sí (${SHOTSTACK_API_KEY.substring(0, 8)}...)` : 'No');
    console.log('📝 Producto:', productName);

    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

    // Videos de fondo de Pexels (vertical 9:16 para reels)
    let backgroundVideoUrl = null;

    if (PEXELS_API_KEY) {
      try {
        // Buscar videos verticales - queries mejoradas para productos
        const pexelsQueries = ['abstract', 'particles', 'neon', 'bokeh', 'sparkle', 'geometric', 'gradient', 'light'];
        const randomQuery = pexelsQueries[Math.floor(Math.random() * pexelsQueries.length)];

        const pexelsResponse = await fetch(`https://api.pexels.com/videos/search?query=${randomQuery}&orientation=portrait&per_page=15`, {
          headers: {
            'Authorization': PEXELS_API_KEY
          }
        });

        if (pexelsResponse.ok) {
          const pexelsData = await pexelsResponse.json();
          if (pexelsData.videos && pexelsData.videos.length > 0) {
            const randomVideo = pexelsData.videos[Math.floor(Math.random() * pexelsData.videos.length)];
            const videoFile = randomVideo.video_files.find(f => f.height >= 1280 && f.width / f.height < 1) || randomVideo.video_files[0];
            backgroundVideoUrl = videoFile.link;
            console.log('🎥 Video de fondo de Pexels:', backgroundVideoUrl);
          }
        }
      } catch (error) {
        console.log('⚠️ No se pudo obtener video de Pexels:', error.message);
      }
    }

    // Transiciones y efectos más atractivos para reels
    const transitionsIn = ['fade', 'slideLeft', 'slideRight', 'slideUp'];
    const transitionsOut = ['fade', 'slideLeft', 'slideRight', 'slideDown'];
    const effects = ['zoomIn', 'zoomOut', 'slideLeft', 'slideRight'];

    const randomTransitionIn = transitionsIn[Math.floor(Math.random() * transitionsIn.length)];
    const randomTransitionOut = transitionsOut[Math.floor(Math.random() * transitionsOut.length)];
    const randomEffect = effects[Math.floor(Math.random() * effects.length)];

    // Música de fondo desde Cloudinary
    const musicTracks = [
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648049/hype-drill-music-438398.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648049/sweet-life-luxury-chill-438146.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648046/music-free-458044.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648045/for-p-453681.mp3',
      'https://res.cloudinary.com/dlshym1te/video/upload/v1767648044/fresh-457883.mp3'
    ];
    const randomMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];

    console.log('🎲 Elementos aleatorios seleccionados:');
    console.log('- Transición entrada:', randomTransitionIn);
    console.log('- Transición salida:', randomTransitionOut);
    console.log('- Efecto:', randomEffect);
    console.log('- Música:', randomMusic);

    // Construir los tracks del video
    const tracks = [];

    // TRACK 1: Video de fondo de Pexels (oscurecido para mejor contraste)
    if (backgroundVideoUrl) {
      tracks.push({
        clips: [
          {
            asset: {
              type: 'video',
              src: backgroundVideoUrl
            },
            start: 0,
            length: 30,
            fit: 'crop',
            opacity: 0.6,
            effect: randomEffect,
            transition: {
              in: randomTransitionIn,
              out: randomTransitionOut
            }
          }
        ]
      });
    }

    // Sin imagen del producto - solo texto, video de fondo y audio

    // URL del webhook de Make.com para notificar cuando el reel está listo
    const callbackUrl = `https://hook.us2.make.com/qcvtjdf5o81w8lu9vwx1v5arhsty3f28?productId=${productId}`;

    const videoConfig = {
      timeline: {
        background: '#000000',
        soundtrack: {
          src: randomMusic,
          effect: 'fadeInFadeOut',
          volume: 0.5
        },
        tracks: tracks.concat([
          // TRACK 2: Nombre del producto (aparece al inicio y al final)
          {
            clips: [
              // Aparición inicial (segundos 0-6)
              {
                asset: {
                  type: 'html',
                  html: `<p>${productName}</p>`,
                  css: 'p { font-family: Montserrat; font-size: 54px; color: #FFFFFF; font-weight: 900; text-align: center; text-shadow: 3px 3px 6px rgba(0,0,0,0.8); }',
                  width: 1000,
                  height: 200
                },
                start: 0,
                length: 6,
                fit: 'none',
                position: 'top',
                offset: {
                  x: 0,
                  y: -0.15
                },
                transition: {
                  in: 'slideDown',
                  out: 'fade'
                }
              },
              // Aparición final (segundos 24-30)
              {
                asset: {
                  type: 'html',
                  html: `<p>${productName}</p>`,
                  css: 'p { font-family: Montserrat; font-size: 54px; color: #FFFFFF; font-weight: 900; text-align: center; text-shadow: 3px 3px 6px rgba(0,0,0,0.8); }',
                  width: 1000,
                  height: 200
                },
                start: 24,
                length: 6,
                fit: 'none',
                position: 'top',
                offset: {
                  x: 0,
                  y: -0.15
                },
                transition: {
                  in: 'slideDown',
                  out: 'fade'
                }
              }
            ]
          },
          // TRACK 3: Precio (aparece al inicio y al final con colores diferentes)
          {
            clips: [
              // Precio inicial - blanco (segundos 0-6)
              {
                asset: {
                  type: 'html',
                  html: `<p>${price || 'Consultar precio'}</p>`,
                  css: 'p { font-family: Montserrat; font-size: 48px; color: #FFFFFF; font-weight: 700; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }',
                  width: 800,
                  height: 150
                },
                start: 0,
                length: 6,
                fit: 'none',
                position: 'bottom',
                offset: {
                  x: 0,
                  y: 0.15
                },
                transition: {
                  in: 'slideUp',
                  out: 'fade'
                }
              },
              // Precio final - rojo (segundos 24-30)
              {
                asset: {
                  type: 'html',
                  html: `<p>${price || 'Consultar precio'}</p>`,
                  css: 'p { font-family: Montserrat; font-size: 48px; color: #FF3333; font-weight: 700; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }',
                  width: 800,
                  height: 150
                },
                start: 24,
                length: 6,
                fit: 'none',
                position: 'bottom',
                offset: {
                  x: 0,
                  y: 0.15
                },
                transition: {
                  in: 'slideUp',
                  out: 'fade'
                }
              }
            ]
          },
          // TRACK 4: Call to Action en el medio del video
          {
            clips: [
              {
                asset: {
                  type: 'html',
                  html: '<p>marianoaliandri.com.ar</p>',
                  css: 'p { font-family: Montserrat; font-size: 32px; color: #FFD700; font-weight: 600; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.9); }',
                  width: 800,
                  height: 100
                },
                start: 12,
                length: 6,
                fit: 'none',
                position: 'bottom',
                offset: {
                  x: 0,
                  y: 0.1
                },
                transition: {
                  in: 'fade',
                  out: 'fade'
                }
              }
            ]
          }
        ])
      },
      output: {
        format: 'mp4',
        resolution: '1080',  // MEJORA: Full HD en lugar de 'hd' (720p)
        aspectRatio: '9:16',
        fps: 30
      },
      callback: callbackUrl
    };

    console.log('🎬 Solicitando generación de video mejorado a Shotstack...');
    console.log('📋 Config:', JSON.stringify(videoConfig, null, 2));

    // Enviar request a Shotstack
    const response = await fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
      },
      body: JSON.stringify(videoConfig)
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Error de Shotstack (status ' + response.status + '):', error);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'Failed to generate video',
          details: error,
          shotstackStatus: response.status
        })
      };
    }

    const result = await response.json();

    console.log('✅ Video solicitado. ID:', result.response.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        renderId: result.response.id,
        message: 'Video generation started with text, background video and audio',
        statusUrl: `https://api.shotstack.io/stage/render/${result.response.id}`
      })
    };

  } catch (error) {
    console.error('❌ Error en generate-reel:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}
