// Browser-only: Canvas animation + MediaRecorder service
// NO deps externas — usa Canvas API, MediaRecorder, Web Audio API, Web Speech API

const MUSIC_BASE = 'https://res.cloudinary.com/dlshym1te/video/upload';

export const MUSIC_TRACKS = [
  { name: 'Hype',       url: `${MUSIC_BASE}/v1767648049/hype-drill-music-438398.mp3` },
  { name: 'Chill',      url: `${MUSIC_BASE}/v1767648049/sweet-life-luxury-chill-438146.mp3` },
  { name: 'Neutro',     url: `${MUSIC_BASE}/v1767648046/music-free-458044.mp3` },
  { name: 'Energético', url: `${MUSIC_BASE}/v1767648045/for-p-453681.mp3` },
  { name: 'Fresh',      url: `${MUSIC_BASE}/v1767648044/fresh-457883.mp3` },
];

export const TEXT_EFFECTS = [
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'slideup',    label: 'Slide Up' },
  { id: 'fadezoom',   label: 'Fade + Zoom' },
  { id: 'highlight',  label: 'Highlight' },
  { id: 'glitch',     label: 'Glitch' },
  { id: 'particles',  label: 'Partículas' },
];

class CanvasReelService {
  constructor() {
    this.animationId = null;
    this.startTime = null;
  }

  // ── Image helpers ──────────────────────────────────────────────────────────

  async loadImages(urls) {
    return Promise.all(
      (urls || []).filter(Boolean).map(
        (url) =>
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
          })
      )
    );
  }

  drawBgImage(ctx, img, w, h, alpha = 1) {
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
    ctx.restore();
  }

  // ── Frame rendering ────────────────────────────────────────────────────────

  drawFrame(ctx, w, h, elapsed, config) {
    const { images = [], duration, title, subtitle, textEffect } = config;
    const validImgs = images.filter(Boolean);

    // Background
    ctx.clearRect(0, 0, w, h);
    if (validImgs.length > 0) {
      const imgDur = duration / validImgs.length;
      const idx = Math.floor(elapsed / imgDur) % validImgs.length;
      const next = (idx + 1) % validImgs.length;
      const localP = (elapsed % imgDur) / imgDur;
      const crossStart = 0.75;

      if (localP > crossStart) {
        const alpha = (localP - crossStart) / (1 - crossStart);
        this.drawBgImage(ctx, validImgs[idx], w, h, 1);
        this.drawBgImage(ctx, validImgs[next], w, h, alpha);
      } else {
        this.drawBgImage(ctx, validImgs[idx], w, h, 1);
      }
    } else {
      // Animated gradient fallback
      const grad = ctx.createLinearGradient(0, 0, w, h);
      const hue = (elapsed * 15) % 360;
      grad.addColorStop(0, `hsl(${hue}, 70%, 18%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 8%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, 0, w, h);

    // Text
    this._drawText(ctx, w, h, elapsed, title, subtitle, textEffect);

    // Progress bar
    const barH = Math.max(5, h * 0.004);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, h - barH, w, barH);
    const pg = ctx.createLinearGradient(0, 0, w, 0);
    pg.addColorStop(0, '#a855f7');
    pg.addColorStop(1, '#3b82f6');
    ctx.fillStyle = pg;
    ctx.fillRect(0, h - barH, w * Math.min(elapsed / duration, 1), barH);

    // Branding
    const brandSize = Math.max(18, w * 0.027);
    ctx.save();
    ctx.font = `600 ${brandSize}px Montserrat, sans-serif`;
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.fillText('marianoaliandri.com.ar', w / 2, h - brandSize * 2);
    ctx.restore();
  }

  _drawText(ctx, w, h, elapsed, title, subtitle, effect) {
    const tSize = Math.max(36, w * 0.054);
    const sSize = Math.max(22, w * 0.036);
    const cy = h * 0.42;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 14;
    ctx.textAlign = 'center';

    switch (effect) {
      case 'typewriter': {
        const tChars = Math.floor(title.length * Math.min(elapsed * 2.5, 1));
        ctx.font = `900 ${tSize}px Montserrat, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText(title.slice(0, tChars), w / 2, cy);
        if (subtitle) {
          const sChars = Math.floor(subtitle.length * Math.min((elapsed - 0.8) * 3, 1));
          if (sChars > 0) {
            ctx.font = `700 ${sSize}px Montserrat, sans-serif`;
            ctx.fillStyle = '#c4b5fd';
            ctx.fillText(subtitle.slice(0, sChars), w / 2, cy + tSize * 1.5);
          }
        }
        break;
      }

      case 'slideup': {
        const tA = Math.min(elapsed * 3, 1);
        const tY = cy + (1 - tA) * 70;
        ctx.globalAlpha = tA;
        ctx.font = `900 ${tSize}px Montserrat, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText(title, w / 2, tY);
        if (subtitle) {
          const sA = Math.min(Math.max(elapsed - 0.6, 0) * 3, 1);
          const sY = cy + tSize * 1.5 + (1 - sA) * 50;
          ctx.globalAlpha = sA;
          ctx.font = `700 ${sSize}px Montserrat, sans-serif`;
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText(subtitle, w / 2, sY);
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'fadezoom': {
        const a = Math.min(elapsed * 2.5, 1);
        const sc = 0.75 + a * 0.25;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(w / 2, cy);
        ctx.scale(sc, sc);
        ctx.font = `900 ${tSize}px Montserrat, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText(title, 0, 0);
        if (subtitle) {
          ctx.font = `700 ${sSize}px Montserrat, sans-serif`;
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText(subtitle, 0, tSize * 1.5);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }

      case 'highlight': {
        ctx.font = `900 ${tSize}px Montserrat, sans-serif`;
        const words = title.split(' ');
        const wordProgress = elapsed * 1.8;
        const widths = words.map((wd) => ctx.measureText(wd + ' ').width);
        const total = widths.reduce((a, b) => a + b, 0);
        let x = w / 2 - total / 2;
        ctx.textAlign = 'left';
        words.forEach((wd, i) => {
          ctx.fillStyle = i < wordProgress ? '#a855f7' : '#fff';
          ctx.fillText(wd + ' ', x, cy);
          x += widths[i];
        });
        if (subtitle) {
          ctx.textAlign = 'center';
          ctx.font = `700 ${sSize}px Montserrat, sans-serif`;
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText(subtitle, w / 2, cy + tSize * 1.5);
        }
        break;
      }

      case 'glitch': {
        const g = Math.sin(elapsed * 9) * Math.sin(elapsed * 4) * (w * 0.008);
        ctx.font = `900 ${tSize}px Montserrat, sans-serif`;
        ctx.fillStyle = 'rgba(255,0,80,0.55)';
        ctx.fillText(title, w / 2 + g, cy - 2);
        ctx.fillStyle = 'rgba(0,200,255,0.55)';
        ctx.fillText(title, w / 2 - g, cy + 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(title, w / 2, cy);
        if (subtitle) {
          ctx.font = `700 ${sSize}px Montserrat, sans-serif`;
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText(subtitle, w / 2, cy + tSize * 1.5);
        }
        break;
      }

      case 'particles': {
        ctx.font = `900 ${tSize}px Montserrat, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText(title, w / 2, cy);
        for (let i = 0; i < 22; i++) {
          const angle = (i / 22) * Math.PI * 2 + elapsed * 1.8;
          const r = (60 + Math.sin(elapsed * 3 + i) * 30) * (w / 270);
          const px = w / 2 + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r * 0.28;
          const pa = 0.25 + Math.sin(elapsed * 5 + i) * 0.25;
          ctx.beginPath();
          ctx.arc(px, py, (2 + Math.sin(elapsed * 4 + i)) * (w / 270), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168,85,247,${pa})`;
          ctx.fill();
        }
        if (subtitle) {
          ctx.font = `700 ${sSize}px Montserrat, sans-serif`;
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText(subtitle, w / 2, cy + tSize * 1.5);
        }
        break;
      }

      default: {
        ctx.font = `900 ${tSize}px Montserrat, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText(title, w / 2, cy);
        if (subtitle) {
          ctx.font = `700 ${sSize}px Montserrat, sans-serif`;
          ctx.fillStyle = '#c4b5fd';
          ctx.fillText(subtitle, w / 2, cy + tSize * 1.5);
        }
      }
    }
    ctx.restore();
  }

  // ── Preview (loop en canvas pequeño) ──────────────────────────────────────

  startPreview(canvas, config, images) {
    this.stopPreview();
    const ctx = canvas.getContext('2d');
    this.startTime = performance.now();

    const loop = (now) => {
      const elapsed = ((now - this.startTime) / 1000) % (config.duration || 15);
      this.drawFrame(ctx, canvas.width, canvas.height, elapsed, { ...config, images: images || [] });
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stopPreview() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // ── Audio setup ────────────────────────────────────────────────────────────

  async setupAudio(musicUrl) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const audioCtx = new AudioCtx();
      const res = await fetch(musicUrl, { mode: 'cors' });
      const buf = await res.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(buf);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;

      const gain = audioCtx.createGain();
      gain.gain.value = 0.6;

      const dest = audioCtx.createMediaStreamDestination();
      source.connect(gain);
      gain.connect(dest);
      source.start(0);

      return { stream: dest.stream, source, audioCtx };
    } catch (e) {
      console.warn('Audio setup failed:', e.message);
      return null;
    }
  }

  // ── Grabación ─────────────────────────────────────────────────────────────

  async record(config, images, onProgress) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    let audioSetup = null;
    if (config.musicUrl) {
      audioSetup = await this.setupAudio(config.musicUrl);
    }

    const videoStream = canvas.captureStream(30);
    const allTracks = [...videoStream.getVideoTracks()];
    if (audioSetup?.stream) allTracks.push(...audioSetup.stream.getAudioTracks());
    const stream = new MediaStream(allTracks);

    const mimeType =
      ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
        MediaRecorder.isTypeSupported(m)
      ) || 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        audioSetup?.source?.stop?.();
        audioSetup?.audioCtx?.close?.();
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = (e) => reject(e.error);
      recorder.start(100);

      const t0 = performance.now();

      const renderLoop = (now) => {
        const elapsed = (now - t0) / 1000;
        if (elapsed >= config.duration) {
          onProgress?.(1);
          recorder.stop();
          return;
        }
        onProgress?.(elapsed / config.duration);
        this.drawFrame(ctx, 1080, 1920, elapsed, { ...config, images: images || [] });
        requestAnimationFrame(renderLoop);
      };
      requestAnimationFrame(renderLoop);
    });
  }
}

export const canvasReelService = new CanvasReelService();
export default canvasReelService;
