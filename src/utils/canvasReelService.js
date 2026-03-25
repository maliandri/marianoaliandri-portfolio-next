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

// CTA por tipo de contenido
const CTA_TEXT = {
  producto:   'Consultá disponibilidad',
  tecnologia: 'Lo implemento en tu proyecto',
  proyecto:   'Ver proyecto en vivo',
  default:    'marianoaliandri.com.ar',
};

class CanvasReelService {
  constructor() {
    this.animationId = null;
    this.startTime  = null;
  }

  // ── Image helpers ──────────────────────────────────────────────────────────

  async loadImages(urls) {
    return Promise.all(
      (urls || []).filter(Boolean).map(
        (url) =>
          new Promise((resolve) => {
            const img     = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src     = url;
          })
      )
    );
  }

  // Cover crop: imagen cubre TODO el canvas sin bordes negros
  drawBgImage(ctx, img, W, H, alpha = 1) {
    if (!img) return;
    const imgRatio    = img.width / img.height;
    const canvasRatio = W / H;
    let sx, sy, sw, sh;
    if (imgRatio > canvasRatio) {
      sh = img.height;
      sw = sh * canvasRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / canvasRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    ctx.restore();
  }

  // ── Text helpers ───────────────────────────────────────────────────────────

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  adaptiveFontSize(ctx, text, maxWidth, base, min = 28) {
    let size = base;
    while (size > min) {
      ctx.font = `900 ${size}px Montserrat, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 4;
    }
    return size;
  }

  // ── Frame rendering — layout 3 zonas ──────────────────────────────────────
  // Zona superior  0–20%  : branding
  // Zona central  20–80%  : imagen + texto animado
  // Zona inferior 80–100% : CTA + progress bar

  drawFrame(ctx, W, H, elapsed, config) {
    const { images = [], duration, title, subtitle, textEffect, contentType = 'default' } = config;
    const validImgs = images.filter(Boolean);
    const topH      = H * 0.20;
    const midH      = H * 0.60;
    const botH      = H * 0.20;
    const midY      = topH;
    const botY      = topH + midH;

    // ── 1. Fondo base con colores configurables ─────────────────────────────
    if (config.bgColors && config.bgColors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, config.bgColors[0]);
      grad.addColorStop(1, config.bgColors[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#000';
    }
    ctx.fillRect(0, 0, W, H);

    // ── 2. Miniatura producto (derecha superior) ───────────────────────────
    if (config.thumbnailImage) {
      this._drawThumbnail(ctx, config.thumbnailImage, W, H);
    } else if (config.images && config.images.length > 0) {
      this._drawThumbnail(ctx, config.images[0], W, H);
    }

    // ── 3. Imagen de fondo (cover, zona central) ─────────────────────────────
    if (validImgs.length > 0) {
      const imgDur   = duration / validImgs.length;
      const idx      = Math.floor(elapsed / imgDur) % validImgs.length;
      const next     = (idx + 1) % validImgs.length;
      const localP   = (elapsed % imgDur) / imgDur;
      const crossStart = 0.75;

      // Recortar contexto a zona central para el crossfade
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, midY, W, midH);
      ctx.clip();

      if (localP > crossStart) {
        const crossAlpha = (localP - crossStart) / (1 - crossStart);
        this._drawCoverInZone(ctx, validImgs[idx],  W, midH, midY, 1);
        this._drawCoverInZone(ctx, validImgs[next], W, midH, midY, crossAlpha);
      } else {
        this._drawCoverInZone(ctx, validImgs[idx], W, midH, midY, 1);
      }
      ctx.restore();
    } else {
      // Gradiente animado fallback
      const hue  = (elapsed * 15) % 360;
      const grad = ctx.createLinearGradient(0, midY, W, midY + midH);
      grad.addColorStop(0, `hsl(${hue}, 70%, 18%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 8%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, midY, W, midH);
    }

    // ── 3. Overlay sobre imagen ──────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.fillRect(0, midY, W, midH);

    // ── 4. Zona superior: gradiente oscuro + branding ────────────────────────
    const topGrad = ctx.createLinearGradient(0, 0, 0, topH);
    topGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
    topGrad.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, topH);

    const brandSize = Math.max(22, W * 0.032);
    ctx.save();
    ctx.font        = `700 ${brandSize}px Montserrat, sans-serif`;
    ctx.fillStyle   = '#FFD700';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 10;
    ctx.textAlign   = 'center';
    ctx.fillText('marianoaliandri.com.ar', W / 2, topH * 0.6);
    ctx.restore();

    // ── 5. Texto principal (zona central, clipeado para no pisar CTA) ─────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, midY, W, midH);
    ctx.clip();
    this._drawText(ctx, W, H, midY, midH, elapsed, title, subtitle, textEffect, duration);
    ctx.restore();

    // ── 6. Zona inferior: fondo oscuro + CTA ─────────────────────────────────
    const botGrad = ctx.createLinearGradient(0, botY, 0, H);
    botGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
    botGrad.addColorStop(1, 'rgba(0,0,0,0.90)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, botY, W, botH);

    const cta      = CTA_TEXT[contentType] || CTA_TEXT.default;
    const ctaSize  = Math.max(18, W * 0.028);
    ctx.save();
    ctx.font        = `600 ${ctaSize}px Montserrat, sans-serif`;
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 8;
    ctx.textAlign   = 'center';
    ctx.fillText(cta, W / 2, botY + botH * 0.45);
    ctx.restore();

    // ── 7. Barra de progreso ─────────────────────────────────────────────────
    const barH = Math.max(6, H * 0.005);
    const barY = H - barH;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, barY, W, barH);
    const pg = ctx.createLinearGradient(0, 0, W, 0);
    pg.addColorStop(0, '#a855f7');
    pg.addColorStop(1, '#3b82f6');
    ctx.fillStyle = pg;
    ctx.fillRect(0, barY, W * Math.min(elapsed / duration, 1), barH);
  }

  // Dibuja imagen cover dentro de una zona Y offset (sin clip externo)
  _drawCoverInZone(ctx, img, W, zoneH, zoneY, alpha) {
    if (!img) return;
    const imgRatio    = img.width / img.height;
    const zoneRatio   = W / zoneH;
    let sx, sy, sw, sh;
    if (imgRatio > zoneRatio) {
      sh = img.height;
      sw = sh * zoneRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / zoneRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sw, sh, 0, zoneY, W, zoneH);
    ctx.restore();
  }

  _drawText(ctx, W, H, midY, midH, elapsed, title, subtitle, effect, duration) {
    const maxW   = W - 80;
    const base   = Math.max(58, W * 0.085);
    const subBase= Math.max(34, W * 0.052);
    const textCY = midY + midH * 0.5;
    const pad    = W * 0.04;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 16;
    ctx.textAlign   = 'center';

    // Tamaño adaptativo
    const tSize = this.adaptiveFontSize(ctx, title, maxW, base);
    ctx.font    = `900 ${tSize}px Montserrat, sans-serif`;
    const lines = this.wrapText(ctx, title, maxW);
    const lineH = tSize * 1.2;
    const totalTitleH = lines.length * lineH;

    // Pill de fondo detrás del título
    const pillPad = pad * 0.6;
    const pillW   = Math.min(maxW + pillPad * 2, W - 40);
    const pillH   = totalTitleH + pillPad * 2;
    const pillX   = (W - pillW) / 2;
    const pillY   = textCY - totalTitleH / 2 - pillPad;

    switch (effect) {
      case 'typewriter': {
        const fullText  = lines.join(' ');
        const visChars  = Math.floor(fullText.length * Math.min(elapsed * 2, 1));
        const visText   = fullText.slice(0, visChars);
        const visLines  = this.wrapText(ctx, visText || ' ', maxW);
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        ctx.fillStyle = '#fff';
        visLines.forEach((l, i) => ctx.fillText(l, W / 2, textCY - totalTitleH / 2 + tSize + i * lineH));
        break;
      }

      case 'slideup': {
        const a  = Math.min(elapsed * 3, 1);
        const dy = (1 - a) * 80;
        ctx.globalAlpha = a;
        this._drawPill(ctx, pillX, pillY + dy, pillW, pillH);
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, W / 2, textCY - totalTitleH / 2 + tSize + i * lineH + dy));
        ctx.globalAlpha = 1;
        break;
      }

      case 'fadezoom': {
        const a  = Math.min(elapsed * 2.5, 1);
        const sc = 0.75 + a * 0.25;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(W / 2, textCY);
        ctx.scale(sc, sc);
        this._drawPill(ctx, -(pillW / 2), -totalTitleH / 2 - pillPad, pillW, pillH);
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, 0, -totalTitleH / 2 + tSize + i * lineH));
        ctx.restore();
        ctx.globalAlpha = 1;
        break;
      }

      case 'highlight': {
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        const allWords   = title.split(' ');
        const wordProg   = elapsed * 2;
        ctx.font         = `900 ${tSize}px Montserrat, sans-serif`;
        // Reconstruir líneas con highlight por palabra
        let wordCount    = 0;
        lines.forEach((line, li) => {
          const lWords = line.split(' ');
          const lWidths = lWords.map((w) => ctx.measureText(w + ' ').width);
          const lTotal  = lWidths.reduce((a, b) => a + b, 0);
          let x = W / 2 - lTotal / 2;
          ctx.textAlign = 'left';
          lWords.forEach((w, wi) => {
            ctx.fillStyle = wordCount < wordProg ? '#a855f7' : '#fff';
            ctx.fillText(w + ' ', x, textCY - totalTitleH / 2 + tSize + li * lineH);
            x += lWidths[wi];
            wordCount++;
          });
        });
        ctx.textAlign = 'center';
        break;
      }

      case 'glitch': {
        const g = Math.sin(elapsed * 9) * Math.sin(elapsed * 4) * (W * 0.008);
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        const drawGlitchLines = (color, ox, oy) => {
          ctx.fillStyle = color;
          lines.forEach((l, i) => ctx.fillText(l, W / 2 + ox, textCY - totalTitleH / 2 + tSize + i * lineH + oy));
        };
        drawGlitchLines('rgba(255,0,80,0.55)',  g, -2);
        drawGlitchLines('rgba(0,200,255,0.55)', -g,  2);
        drawGlitchLines('#fff', 0, 0);
        break;
      }

      case 'particles': {
        // Partículas alrededor del título
        for (let i = 0; i < 24; i++) {
          const angle = (i / 24) * Math.PI * 2 + elapsed * 1.8;
          const r     = (55 + Math.sin(elapsed * 3 + i) * 25) * (W / 270);
          const px    = W / 2 + Math.cos(angle) * r;
          const py    = textCY + Math.sin(angle) * r * 0.22;
          const pa    = 0.2 + Math.sin(elapsed * 5 + i) * 0.2;
          ctx.beginPath();
          ctx.arc(px, py, (2 + Math.sin(elapsed * 4 + i)) * (W / 270), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168,85,247,${pa})`;
          ctx.fill();
        }
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, W / 2, textCY - totalTitleH / 2 + tSize + i * lineH));
        break;
      }

      default: {
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, W / 2, textCY - totalTitleH / 2 + tSize + i * lineH));
      }
    }

    // Subtítulo (con wrap)
    if (subtitle) {
      const sSize = Math.max(24, subBase * 0.75);
      ctx.font      = `600 ${sSize}px Montserrat, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.shadowBlur = 8;
      const subLines = this.wrapText(ctx, subtitle, maxW);
      const subLineH = sSize * 1.3;
      let subY = textCY + totalTitleH / 2 + sSize * 1.8;
      subLines.forEach((line) => {
        ctx.fillText(line, W / 2, subY);
        subY += subLineH;
      });
    }

    ctx.restore();
  }

  // Pill oscuro semitransparente detrás del texto
  _drawPill(ctx, x, y, w, h) {
    const r = Math.min(20, h / 2);
    ctx.save();
    ctx.fillStyle   = 'rgba(0,0,0,0.55)';
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawThumbnail(ctx, img, W, H) {
    if (!img) return;
    const margin = Math.max(16, W * 0.02);
    const size = Math.min(170, W * 0.18, H * 0.18);
    const x = W - size - margin;
    const y = margin;

    // Fondo brillante para destacar la miniatura
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.35)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(255,255,255,0.17)';
    ctx.beginPath();
    ctx.moveTo(x + 18, y);
    ctx.lineTo(x + size - 18, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + 18);
    ctx.lineTo(x + size, y + size - 18);
    ctx.quadraticCurveTo(x + size, y + size, x + size - 18, y + size);
    ctx.lineTo(x + 18, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - 18);
    ctx.lineTo(x, y + 18);
    ctx.quadraticCurveTo(x, y, x + 18, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Clip para dibujo de imagen en miniatura
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 0);
    ctx.lineTo(x + size - 14, y + 0);
    ctx.quadraticCurveTo(x + size, y + 0, x + size, y + 14);
    ctx.lineTo(x + size, y + size - 14);
    ctx.quadraticCurveTo(x + size, y + size, x + size - 14, y + size);
    ctx.lineTo(x + 14, y + size);
    ctx.quadraticCurveTo(x + 0, y + size, x + 0, y + size - 14);
    ctx.lineTo(x + 0, y + 14);
    ctx.quadraticCurveTo(x + 0, y + 0, x + 14, y + 0);
    ctx.closePath();
    ctx.clip();

    const imgRatio = img.width / img.height;
    const targetRatio = 1;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgRatio > targetRatio) {
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / targetRatio;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, size, size);
    ctx.restore();
  }

  // ── Preview (loop en canvas pequeño) ──────────────────────────────────────

  startPreview(canvas, config, images) {
    this.stopPreview();
    const ctx        = canvas.getContext('2d');
    this.startTime   = performance.now();

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

  // ── Audio helpers ─────────────────────────────────────────────────────────

  async _fetchAudioBuffer(audioCtx, url) {
    const res = await fetch(url, { mode: 'cors' });
    const buf = await res.arrayBuffer();
    return audioCtx.decodeAudioData(buf);
  }

  async _base64ToAudioBuffer(audioCtx, base64) {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return audioCtx.decodeAudioData(bytes.buffer);
  }

  // Prepara buffers de voz y música para preview
  async prepareAudio(ttsBase64, musicUrl) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const audioCtx = new AudioCtx();
      const [voiceBuffer, musicBuffer] = await Promise.all([
        ttsBase64 ? this._base64ToAudioBuffer(audioCtx, ttsBase64) : Promise.resolve(null),
        musicUrl  ? this._fetchAudioBuffer(audioCtx, musicUrl)      : Promise.resolve(null),
      ]);
      await audioCtx.close();
      return { voiceBuffer, musicBuffer };
    } catch (e) {
      console.warn('prepareAudio failed:', e.message);
      return null;
    }
  }

  // Preview de audio (voice o music) en el browser
  async playAudioPreview(base64OrUrl, isBase64 = false) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const buffer   = isBase64
        ? await this._base64ToAudioBuffer(audioCtx, base64OrUrl)
        : await this._fetchAudioBuffer(audioCtx, base64OrUrl);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
      source.onended = () => audioCtx.close();
      return { source, audioCtx };
    } catch (e) {
      console.warn('playAudioPreview failed:', e.message);
    }
  }

  async setupAudio(musicUrl, ttsBase64 = null) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const audioCtx = new AudioCtx();
      const dest     = audioCtx.createMediaStreamDestination();
      const sources  = [];

      if (ttsBase64) {
        const voiceBuf    = await this._base64ToAudioBuffer(audioCtx, ttsBase64);
        const voiceSrc    = audioCtx.createBufferSource();
        voiceSrc.buffer   = voiceBuf;
        const voiceGain   = audioCtx.createGain();
        voiceGain.gain.value = 1.0;
        voiceSrc.connect(voiceGain);
        voiceGain.connect(dest);
        voiceSrc.start(0);
        sources.push(voiceSrc);
      }

      if (musicUrl) {
        const musicBuf    = await this._fetchAudioBuffer(audioCtx, musicUrl);
        const musicSrc    = audioCtx.createBufferSource();
        musicSrc.buffer   = musicBuf;
        musicSrc.loop     = true;
        const musicGain   = audioCtx.createGain();
        musicGain.gain.value = ttsBase64 ? 0.25 : 0.6;
        musicSrc.connect(musicGain);
        musicGain.connect(dest);
        musicSrc.start(0);
        sources.push(musicSrc);
      }

      return { stream: dest.stream, sources, audioCtx };
    } catch (e) {
      console.warn('Audio setup failed:', e.message);
      return null;
    }
  }

  // ── Grabación ─────────────────────────────────────────────────────────────

  async record(config, images, onProgress) {
    const canvas  = document.createElement('canvas');
    canvas.width  = 1080;
    canvas.height = 1920;
    const ctx     = canvas.getContext('2d');

    let audioSetup = null;
    if (config.musicUrl || config.ttsBase64) {
      audioSetup = await this.setupAudio(config.musicUrl, config.ttsBase64);
    }

    const videoStream = canvas.captureStream(30);
    const allTracks   = [...videoStream.getVideoTracks()];
    if (audioSetup?.stream) allTracks.push(...audioSetup.stream.getAudioTracks());
    const stream = new MediaStream(allTracks);

    const mimeType =
      ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
        (m) => MediaRecorder.isTypeSupported(m)
      ) || 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks   = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        audioSetup?.sources?.forEach((s) => { try { s.stop(); } catch {} });
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
