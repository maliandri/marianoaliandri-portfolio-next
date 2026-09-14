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

export const CLIP_TRANSITIONS = [
  { id: 'cut',       label: 'Corte' },
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'slide',     label: 'Slide' },
  { id: 'zoom',      label: 'Zoom' },
];

// Fuentes disponibles para el texto de cada clip — se cargan vía Google Fonts
// (ver CanvasReelGenerator, que inyecta el <link> y espera a document.fonts).
export const FONT_FAMILIES = [
  { id: 'montserrat', label: 'Montserrat',       css: '"Montserrat", sans-serif',      google: 'Montserrat:wght@400;600;700;900' },
  { id: 'poppins',    label: 'Poppins',          css: '"Poppins", sans-serif',         google: 'Poppins:wght@400;600;900' },
  { id: 'playfair',   label: 'Playfair (serif)', css: '"Playfair Display", serif',     google: 'Playfair+Display:wght@700;900' },
  { id: 'bebas',      label: 'Bebas Neue',       css: '"Bebas Neue", sans-serif',      google: 'Bebas+Neue' },
  { id: 'jetbrains',  label: 'Mono',             css: '"JetBrains Mono", monospace',   google: 'JetBrains+Mono:wght@400;700' },
];
const DEFAULT_FONT = FONT_FAMILIES[0].css;

// CTA por tipo de contenido
const CTA_TEXT = {
  producto:    'Consultá disponibilidad',
  tecnologia:  'Lo implemento en tu proyecto',
  proyecto:    'Ver proyecto en vivo',
  herramienta: 'Probalo en marianoaliandri.com.ar',
  default:     'marianoaliandri.com.ar',
};

// Ventana de transición entre clips, en segundos — clampeada a como mucho el
// 40% del clip más corto de los dos para que no se coman entre sí.
const TRANSITION_SEC = 0.5;
const MIN_CLIP_DURATION = 0.75;

function totalDurationOf(clips) {
  return (clips || []).reduce((a, c) => a + (c.duration || 0), 0);
}

class CanvasReelService {
  constructor() {
    this.animationId = null;
    this.startTime  = null;
    this._activeVideoId = null; // qué clip de video está "reproduciendo" ahora (evita re-play cada frame)
    this._lastConfig = null;    // config de la última startPreview — para pausar videos al stopPreview
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

  // ── Media helpers (imagen o video, transparente para el resto del motor) ──

  // Devuelve el elemento dibujable de un clip (HTMLImageElement o HTMLVideoElement).
  _mediaOf(clip) {
    if (!clip) return null;
    return clip.type === 'video' ? clip.videoEl : clip.img;
  }

  // drawImage acepta tanto <img> como <video> igual — solo cambia de dónde se
  // lee el tamaño natural.
  _mediaSize(media) {
    if (!media) return { w: 0, h: 0 };
    if (typeof HTMLVideoElement !== 'undefined' && media instanceof HTMLVideoElement) {
      return { w: media.videoWidth, h: media.videoHeight };
    }
    return { w: media.width, h: media.height };
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

  adaptiveFontSize(ctx, text, maxWidth, base, min = 28, fontFamily = DEFAULT_FONT) {
    let size = base;
    while (size > min) {
      ctx.font = `900 ${size}px ${fontFamily}`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 4;
    }
    return size;
  }

  // ── Frame rendering — layout 3 zonas ──────────────────────────────────────
  // Zona superior  0–20%  : branding
  // Zona central  20–80%  : imagen/video + texto animado
  // Zona inferior 80–100% : CTA + progress bar
  //
  // `mode`: 'preview' (loop en vivo, videos suenan por sus parlantes) | 'record'
  // (grabación real, videos mudos pero tapeados a Web Audio vía config.videoGains) |
  // 'static' (frame único del scrubber, todo pausado).
  drawFrame(ctx, W, H, elapsed, config, { mode = 'preview' } = {}) {
    const { clips = [], contentType = 'default' } = config;
    const topH      = H * 0.20;
    const midH      = H * 0.60;
    const botH      = H * 0.20;
    const midY      = topH;
    const botY      = topH + midH;
    const totalDuration = totalDurationOf(clips) || 1;

    // ── 1. Fondo base — degradado de 2 (bitono) o 3 (tritono) colores ───────
    if (config.bgColors && config.bgColors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      const stops = config.bgColors;
      stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#000';
    }
    ctx.fillRect(0, 0, W, H);

    // Grano/textura fílmica — sutil, opcional (config.grainIntensity 0..1)
    if (config.grainIntensity > 0) this._applyGrain(ctx, W, H, config.grainIntensity);

    // ── 2. Resolver el clip activo por duraciones acumuladas (cada clip puede
    // durar distinto — ya no es un reparto parejo del total). localElapsed se
    // resetea solo en cada borde de clip: así el texto se reanima por slide.
    let idx = 0, acc = 0;
    for (let i = 0; i < clips.length; i++) {
      acc += clips[i].duration || 0;
      if (elapsed < acc || i === clips.length - 1) { idx = i; break; }
    }
    const activeClip    = clips[idx];
    const clipStart     = acc - (activeClip?.duration || 0);
    const localElapsed  = elapsed - clipStart;
    const localProgress = activeClip?.duration ? Math.min(1, Math.max(0, localElapsed / activeClip.duration)) : 0;
    const prevClip      = idx > 0 ? clips[idx - 1] : null;

    // ── 3. Sincronizar play/pause/mute/ganancia de los clips de video ANTES de
    // dibujar, así el frame que se lee ya refleja el estado correcto.
    this._syncVideoClips(clips, activeClip, localElapsed, mode, config);

    // ── 4. Miniatura (derecha superior) — del primer clip, imagen o video ───
    if (config.thumbnailImage) {
      this._drawThumbnail(ctx, config.thumbnailImage, W, H);
    } else {
      const firstMedia = this._mediaOf(clips[0]);
      if (firstMedia) this._drawThumbnail(ctx, firstMedia, W, H);
    }

    // ── 5. Imagen/video de fondo + transición (zona central) ────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, midY, W, midH);
    ctx.clip();
    if (activeClip) {
      this._drawClipTransition(ctx, activeClip, prevClip, W, midH, midY, localElapsed, localProgress, config.blurAmount || 0);
    } else {
      // Gradiente animado fallback (sin clips todavía)
      const hue  = (elapsed * 15) % 360;
      const grad = ctx.createLinearGradient(0, midY, W, midY + midH);
      grad.addColorStop(0, `hsl(${hue}, 70%, 18%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 8%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, midY, W, midH);
    }
    ctx.restore();

    // ── Overlay sobre imagen ──────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.fillRect(0, midY, W, midH);

    // ── 6. Zona superior: gradiente oscuro + branding ────────────────────────
    const topGrad = ctx.createLinearGradient(0, 0, 0, topH);
    topGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
    topGrad.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, topH);

    const brandSize = Math.max(22, W * 0.032);
    ctx.save();
    ctx.font        = `700 ${brandSize}px Montserrat, sans-serif`;
    ctx.fillStyle   = '#000000';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 0.25;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 10;
    ctx.textAlign   = 'center';
    ctx.strokeText('marianoaliandri.com.ar', W / 2, topH * 0.6);
    ctx.fillText('marianoaliandri.com.ar', W / 2, topH * 0.6);
    ctx.restore();

    // ── 7. Texto principal — posición libre por clip (no más zona fija) ─────
    if (activeClip) {
      this._drawText(
        ctx, W, H, localElapsed,
        activeClip.title || '', activeClip.subtitle || '', activeClip.textEffect || 'slideup',
        activeClip.textX ?? 0.5, activeClip.textY ?? 0.5, activeClip.textScale ?? 1,
        activeClip.fontFamily || DEFAULT_FONT
      );
    }

    // ── 8. Zona inferior: fondo oscuro + CTA ─────────────────────────────────
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

    // ── 9. Barra de progreso ─────────────────────────────────────────────────
    const barH = Math.max(6, H * 0.005);
    const barY = H - barH;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, barY, W, barH);
    const pg = ctx.createLinearGradient(0, 0, W, 0);
    pg.addColorStop(0, '#a855f7');
    pg.addColorStop(1, '#3b82f6');
    ctx.fillStyle = pg;
    ctx.fillRect(0, barY, W * Math.min(elapsed / totalDuration, 1), barH);
  }

  // Mantiene el estado de reproducción de los clips de video coherente con
  // cuál es el clip activo AHORA MISMO. Se llama una vez por frame — siempre
  // chequea el estado actual antes de tocar play()/pause() para no spamear
  // llamadas innecesarias a 60fps.
  //
  // - Inactivo: pausado siempre, ganancia (si graba) en 0.
  // - Activo, mode 'static' (scrub): pausado, seekea solo si el drift es
  //   notorio (>0.05s) para no encolar seeks en un drag rápido.
  // - Activo, mode 'preview'/'record': si recién se activó, arranca desde 0 y
  //   hace play() (atrapando el rechazo de la promise); en preview el audio
  //   propio suena directo por los parlantes (mute=false), en record queda
  //   muteado (mute=true) porque el audio real se tapea aparte vía
  //   config.videoGains hacia el MediaStreamDestination de la grabación.
  _syncVideoClips(clips, activeClip, localElapsed, mode, config) {
    clips.forEach((c) => {
      if (c.type !== 'video' || !c.videoEl) return;
      const el   = c.videoEl;
      const gain = config?.videoGains?.get?.(c.id);

      if (c !== activeClip) {
        if (!el.paused) el.pause();
        if (gain) gain.gain.value = 0;
        return;
      }

      if (mode === 'static') {
        if (!el.paused) el.pause();
        if (Number.isFinite(localElapsed) && Math.abs(el.currentTime - localElapsed) > 0.05) {
          try { el.currentTime = Math.max(0, localElapsed); } catch { /* video sin metadata todavía */ }
        }
        if (gain) gain.gain.value = 0;
        return;
      }

      if (this._activeVideoId !== c.id) {
        this._activeVideoId = c.id;
        try { el.currentTime = 0; } catch { /* noop */ }
        el.muted = mode === 'record';
        const p = el.play();
        if (p?.catch) p.catch(() => {});
      }
      if (gain) gain.gain.value = c.videoVolume ?? 1;
    });
  }

  // Decide y dibuja la transición del clip ENTRANTE (activeClip) respecto al
  // saliente (prevClip). Si no hay clip previo, es corte, o ya pasó la ventana
  // de transición, dibuja solo el clip activo (comportamiento normal). Funciona
  // igual para imagen o video — ambos se dibujan vía _mediaOf/drawImage.
  _drawClipTransition(ctx, activeClip, prevClip, W, midH, midY, localElapsed, localProgress, blurPx = 0) {
    const activeMedia = this._mediaOf(activeClip);
    const prevMedia   = this._mediaOf(prevClip);
    const type = activeClip.transitionIn || 'cut';
    const windowCap = Math.min(
      TRANSITION_SEC,
      (activeClip.duration || TRANSITION_SEC) * 0.4,
      prevClip ? (prevClip.duration || TRANSITION_SEC) * 0.4 : TRANSITION_SEC
    );

    if (!prevClip || type === 'cut' || localElapsed >= windowCap || windowCap <= 0) {
      this._drawCoverInZone(ctx, activeMedia, W, midH, midY, 1, localProgress, 1, blurPx);
      return;
    }

    const t = localElapsed / windowCap;

    if (type === 'slide') {
      ctx.save();
      ctx.translate(-W * t, 0);
      this._drawCoverInZone(ctx, prevMedia, W, midH, midY, 1, 1, 1, blurPx);
      ctx.restore();
      ctx.save();
      ctx.translate(W * (1 - t), 0);
      this._drawCoverInZone(ctx, activeMedia, W, midH, midY, 1, localProgress, 1, blurPx);
      ctx.restore();
      return;
    }

    if (type === 'zoom') {
      this._drawCoverInZone(ctx, prevMedia, W, midH, midY, 1 - t * 0.5, 1, 1, blurPx);
      const scaleBoost = 0.85 + t * 0.15; // entra achicado y llega a tamaño normal
      this._drawCoverInZone(ctx, activeMedia, W, midH, midY, t, localProgress, scaleBoost, blurPx);
      return;
    }

    // crossfade (default para cualquier otro valor)
    this._drawCoverInZone(ctx, prevMedia, W, midH, midY, 1, 1, 1, blurPx);
    this._drawCoverInZone(ctx, activeMedia, W, midH, midY, t, localProgress, 1, blurPx);
  }

  // Dibuja el media (imagen O video) COMPLETO dentro de la zona (contain, sin
  // recortar) — clave para capturas de sitios web (horizontales) en un reel
  // vertical: con "cover" se veía solo una tira vertical del centro. Deja
  // franjas del fondo a los costados/arriba-abajo si el aspect ratio no
  // coincide (el gradiente ya está pintado detrás). `progress` (0..1, tiempo de
  // ESTE clip en pantalla) agrega un Ken Burns sutil: zoom continuo 1.0→1.06
  // hacia el centro. `extraScale` multiplica ese zoom (lo usa la transición
  // "zoom" para el efecto de entrada).
  _drawCoverInZone(ctx, media, W, zoneH, zoneY, alpha, progress = 0, extraScale = 1, blurPx = 0) {
    if (!media) return;
    const { w: mw, h: mh } = this._mediaSize(media);
    if (!mw || !mh) return; // video sin metadata cargada todavía — se saltea este frame
    const imgRatio  = mw / mh;
    const zoneRatio = W / zoneH;
    let dw, dh;
    if (imgRatio > zoneRatio) {
      dw = W;
      dh = W / imgRatio;
    } else {
      dh = zoneH;
      dw = zoneH * imgRatio;
    }
    const dx = (W - dw) / 2;
    const dy = zoneY + (zoneH - dh) / 2;

    // Ken Burns sobre el destino (el caller ya clipea a la zona, así que el
    // desborde del zoom se recorta solo).
    const zoom = (1 + Math.max(0, Math.min(1, progress)) * 0.06) * extraScale;
    const zdw = dw * zoom;
    const zdh = dh * zoom;
    const zdx = dx - (zdw - dw) / 2;
    const zdy = dy - (zdh - dh) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
    try {
      ctx.drawImage(media, 0, 0, mw, mh, zdx, zdy, zdw, zdh);
    } catch { /* video en un estado no dibujable este frame puntual — se saltea */ }
    ctx.filter = 'none';
    ctx.restore();
  }

  // Overlay de grano/textura fílmica — un tile de ruido chico generado UNA vez
  // (cachea en la instancia) y repetido con blend "overlay", en vez de dibujar
  // ruido pixel a pixel en cada frame (carísimo a 1080x1920/60fps).
  _applyGrain(ctx, W, H, intensity) {
    if (!this._grainCanvas) {
      const size = 128;
      const g = document.createElement('canvas');
      g.width = size; g.height = size;
      const gctx = g.getContext('2d');
      const imageData = gctx.createImageData(size, size);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        imageData.data[i] = v;
        imageData.data[i + 1] = v;
        imageData.data[i + 2] = v;
        imageData.data[i + 3] = 255;
      }
      gctx.putImageData(imageData, 0, 0);
      this._grainCanvas = g;
    }
    const pattern = ctx.createPattern(this._grainCanvas, 'repeat');
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, intensity)) * 0.35;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Posición libre: textX/textY son fracciones 0..1 del canvas COMPLETO
  // (0.5/0.5 = comportamiento de siempre, centrado). textScale multiplica los
  // tamaños de fuente. Ya no hay clip a una zona fija — el texto puede ir a
  // cualquier parte del canvas (el caller decide si clipea o no).
  _drawText(ctx, W, H, elapsed, title, subtitle, effect, textX = 0.5, textY = 0.5, textScale = 1, fontFamily = DEFAULT_FONT) {
    const textCX = W * textX;
    const textCY = H * textY;
    const pad    = W * 0.04;
    const edgeMaxW = 2 * Math.min(textCX, W - textCX) - pad;
    const maxW   = Math.max(120, Math.min(W - 80, edgeMaxW));
    const base   = Math.max(58, W * 0.085) * textScale;
    const subBase= Math.max(34, W * 0.052) * textScale;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 16;
    ctx.textAlign   = 'center';

    // Tamaño adaptativo
    const tSize = this.adaptiveFontSize(ctx, title, maxW, base, 28, fontFamily);
    ctx.font    = `900 ${tSize}px ${fontFamily}`;
    const lines = this.wrapText(ctx, title, maxW);
    const lineH = tSize * 1.2;
    const totalTitleH = lines.length * lineH;

    // Pill de fondo detrás del título
    const pillPad = pad * 0.6;
    const pillW   = Math.min(maxW + pillPad * 2, W - 40);
    const pillH   = totalTitleH + pillPad * 2;
    const pillX   = textCX - pillW / 2;
    const pillY   = textCY - totalTitleH / 2 - pillPad;

    switch (effect) {
      case 'typewriter': {
        const fullText  = lines.join(' ');
        const visChars  = Math.floor(fullText.length * Math.min(elapsed * 2, 1));
        const visText   = fullText.slice(0, visChars);
        const visLines  = this.wrapText(ctx, visText || ' ', maxW);
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        ctx.fillStyle = '#fff';
        visLines.forEach((l, i) => ctx.fillText(l, textCX, textCY - totalTitleH / 2 + tSize + i * lineH));
        break;
      }

      case 'slideup': {
        const a  = Math.min(elapsed * 3, 1);
        const dy = (1 - a) * 80;
        ctx.globalAlpha = a;
        this._drawPill(ctx, pillX, pillY + dy, pillW, pillH);
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, textCX, textCY - totalTitleH / 2 + tSize + i * lineH + dy));
        ctx.globalAlpha = 1;
        break;
      }

      case 'fadezoom': {
        const a  = Math.min(elapsed * 2.5, 1);
        const sc = 0.75 + a * 0.25;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(textCX, textCY);
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
        const wordProg   = elapsed * 2;
        ctx.font         = `900 ${tSize}px ${fontFamily}`;
        // Reconstruir líneas con highlight por palabra
        let wordCount    = 0;
        lines.forEach((line, li) => {
          const lWords = line.split(' ');
          const lWidths = lWords.map((w) => ctx.measureText(w + ' ').width);
          const lTotal  = lWidths.reduce((a, b) => a + b, 0);
          let x = textCX - lTotal / 2;
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
          lines.forEach((l, i) => ctx.fillText(l, textCX + ox, textCY - totalTitleH / 2 + tSize + i * lineH + oy));
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
          const px    = textCX + Math.cos(angle) * r;
          const py    = textCY + Math.sin(angle) * r * 0.22;
          const pa    = 0.2 + Math.sin(elapsed * 5 + i) * 0.2;
          ctx.beginPath();
          ctx.arc(px, py, (2 + Math.sin(elapsed * 4 + i)) * (W / 270), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168,85,247,${pa})`;
          ctx.fill();
        }
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, textCX, textCY - totalTitleH / 2 + tSize + i * lineH));
        break;
      }

      default: {
        this._drawPill(ctx, pillX, pillY, pillW, pillH);
        ctx.fillStyle = '#fff';
        lines.forEach((l, i) => ctx.fillText(l, textCX, textCY - totalTitleH / 2 + tSize + i * lineH));
      }
    }

    // Subtítulo (con wrap)
    if (subtitle) {
      const sSize = Math.max(24, subBase * 0.75);
      ctx.font      = `600 ${sSize}px ${fontFamily}`;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.shadowBlur = 8;
      const subLines = this.wrapText(ctx, subtitle, maxW);
      const subLineH = sSize * 1.3;
      let subY = textCY + totalTitleH / 2 + sSize * 1.8;
      subLines.forEach((line) => {
        ctx.fillText(line, textCX, subY);
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

  _drawThumbnail(ctx, media, W, H) {
    if (!media) return;
    const { w: mw, h: mh } = this._mediaSize(media);
    if (!mw || !mh) return;
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

    const imgRatio = mw / mh;
    const targetRatio = 1;
    let sx = 0, sy = 0, sw = mw, sh = mh;
    if (imgRatio > targetRatio) {
      sw = mh * targetRatio;
      sx = (mw - sw) / 2;
    } else {
      sh = mw / targetRatio;
      sy = (mh - sh) / 2;
    }

    try { ctx.drawImage(media, sx, sy, sw, sh, x, y, size, size); } catch { /* noop */ }
    ctx.restore();
  }

  // ── Preview (loop en canvas pequeño) ──────────────────────────────────────

  // `resumeSeconds` deja retomar el loop desde donde quedó el scrubber del
  // timeline, en vez de siempre arrancar desde 0.
  startPreview(canvas, config, resumeSeconds = 0) {
    this.stopPreview();
    const ctx  = canvas.getContext('2d');
    const totalDuration = totalDurationOf(config.clips) || 15;
    this.startTime = performance.now() - resumeSeconds * 1000;
    this._activeVideoId = null;
    this._lastConfig = config;

    const loop = (now) => {
      const elapsed = ((now - this.startTime) / 1000) % totalDuration;
      this.drawFrame(ctx, canvas.width, canvas.height, elapsed, config, { mode: 'preview' });
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stopPreview() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    // Corta cualquier video que haya quedado sonando/reproduciendo (ej. al
    // arrancar un scrub) — drawFrameAt lo va a re-sincronizar en el próximo frame.
    (this._lastConfig?.clips || []).forEach((c) => {
      if (c.type === 'video' && c.videoEl && !c.videoEl.paused) {
        try { c.videoEl.pause(); } catch { /* noop */ }
      }
    });
  }

  // Renderiza UN frame estático en un tiempo exacto — lo usa el scrubber del
  // timeline mientras el loop de preview está pausado.
  drawFrameAt(canvas, config, elapsedSeconds) {
    const ctx = canvas.getContext('2d');
    this._lastConfig = config;
    this.drawFrame(ctx, canvas.width, canvas.height, elapsedSeconds, config, { mode: 'static' });
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

  // videoEls: [{ id, el }] — un <video> propio de ESTA grabación por cada clip
  // de video (nunca el de preview, ver record()). Cada uno se tapea con su
  // propio GainNode arrancando en 0 — _syncVideoClips sube la ganancia solo
  // mientras ese clip está activo.
  async setupAudio(musicUrl, ttsBase64 = null, voiceVolume = 1.0, musicVolume = null, videoEls = []) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const audioCtx = new AudioCtx();
      const dest     = audioCtx.createMediaStreamDestination();
      const sources  = [];
      const videoGains = new Map();

      if (ttsBase64) {
        const voiceBuf    = await this._base64ToAudioBuffer(audioCtx, ttsBase64);
        const voiceSrc    = audioCtx.createBufferSource();
        voiceSrc.buffer   = voiceBuf;
        const voiceGain   = audioCtx.createGain();
        voiceGain.gain.value = voiceVolume;
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
        musicGain.gain.value = musicVolume !== null ? musicVolume : (ttsBase64 ? 0.25 : 0.6);
        musicSrc.connect(musicGain);
        musicGain.connect(dest);
        musicSrc.start(0);
        sources.push(musicSrc);
      }

      videoEls.forEach(({ id, el }) => {
        try {
          const src  = audioCtx.createMediaElementSource(el);
          const gain = audioCtx.createGain();
          gain.gain.value = 0; // arranca mudo — _syncVideoClips lo sube solo mientras es el activo
          src.connect(gain);
          gain.connect(dest);
          videoGains.set(id, gain);
        } catch (e) {
          console.warn('No se pudo tapear el audio del clip de video', id, e.message);
        }
      });

      return { stream: dest.stream, sources, audioCtx, videoGains };
    } catch (e) {
      console.warn('Audio setup failed:', e.message);
      return null;
    }
  }

  // ── Grabación ─────────────────────────────────────────────────────────────

  async record(config, onProgress) {
    const canvas  = document.createElement('canvas');
    canvas.width  = 1080;
    canvas.height = 1920;
    const ctx     = canvas.getContext('2d');
    const totalDuration = totalDurationOf(config.clips) || 15;

    // Elementos de video PROPIOS de esta grabación — nunca se reusa el de
    // preview, porque createMediaElementSource solo puede llamarse una vez
    // por elemento (y quedaría atado para siempre al AudioContext de preview).
    const videoClips = (config.clips || []).filter((c) => c.type === 'video' && c.videoUrl);
    const recordVideoEls = new Map();
    await Promise.all(videoClips.map((c) => new Promise((resolve) => {
      const el = document.createElement('video');
      el.crossOrigin = 'anonymous';
      el.muted       = true; // se destapea vía Web Audio, no por los parlantes
      el.loop        = true;
      el.playsInline = true;
      recordVideoEls.set(c.id, el);
      const done = () => resolve();
      el.addEventListener('loadedmetadata', done, { once: true });
      el.addEventListener('error', done, { once: true }); // no bloquear la grabación si un video falla
      el.src = c.videoUrl;
    })));

    const recordConfig = {
      ...config,
      clips: (config.clips || []).map((c) => (
        c.type === 'video' ? { ...c, videoEl: recordVideoEls.get(c.id) } : c
      )),
    };

    let audioSetup = null;
    if (config.musicUrl || config.ttsBase64 || recordVideoEls.size > 0) {
      audioSetup = await this.setupAudio(
        config.musicUrl, config.ttsBase64, config.voiceVolume ?? 1.0, config.musicVolume ?? null,
        [...recordVideoEls.entries()].map(([id, el]) => ({ id, el }))
      );
    }
    recordConfig.videoGains = audioSetup?.videoGains;

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

    const cleanupVideoEls = () => {
      recordVideoEls.forEach((el) => {
        try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* noop */ }
      });
    };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        audioSetup?.sources?.forEach((s) => { try { s.stop(); } catch {} });
        audioSetup?.audioCtx?.close?.();
        cleanupVideoEls();
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.onerror = (e) => { cleanupVideoEls(); reject(e.error); };
      recorder.start(100);

      this._activeVideoId = null;
      const t0 = performance.now();
      const renderLoop = (now) => {
        const elapsed = (now - t0) / 1000;
        if (elapsed >= totalDuration) {
          onProgress?.(1);
          recorder.stop();
          return;
        }
        onProgress?.(elapsed / totalDuration);
        this.drawFrame(ctx, 1080, 1920, elapsed, recordConfig, { mode: 'record' });
        requestAnimationFrame(renderLoop);
      };
      requestAnimationFrame(renderLoop);
    });
  }
}

export { MIN_CLIP_DURATION };
export const canvasReelService = new CanvasReelService();
export default canvasReelService;
