'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { canvasReelService, MIN_CLIP_DURATION, FONT_FAMILIES, MUSIC_TRACKS } from '../../utils/canvasReelService';
import ReelTimeline from './ReelTimeline';
import ReelContentPicker from './ReelContentPicker';
import ReelClipProperties from './ReelClipProperties';
import { getToolPlaceholderDataUrl } from '../../utils/toolPlaceholderService';
import cloudinaryService from '../../utils/cloudinaryService';
import { TOOLS } from '../../app/providers';
import { SERVICE_LOGOS } from '../../data/serviceLogos';
import { ExchangeService, formatARS, formatUSD } from '../../utils/exchangeService';

const TECH_ITEMS = [
  { id: 'mercadopago', name: 'MercadoPago Pagos',   category: 'Pagos',          imageUrl: SERVICE_LOGOS.mercadopago },
  { id: 'cloudinary',  name: 'Cloudinary Storage',  category: 'Storage',        imageUrl: SERVICE_LOGOS.cloudinary },
  { id: 'googlegemini',name: 'Google Gemini IA',     category: 'IA',             imageUrl: SERVICE_LOGOS.googlegemini },
  { id: 'firebase',    name: 'Firebase Database',   category: 'Base de Datos',  imageUrl: SERVICE_LOGOS.firebase },
  { id: 'mongodb',     name: 'MongoDB',              category: 'Base de Datos',  imageUrl: SERVICE_LOGOS.mongodb },
  { id: 'resend',      name: 'Resend Email',         category: 'Email',          imageUrl: SERVICE_LOGOS.resend },
  { id: 'vercel',      name: 'Vercel Hosting',       category: 'Hosting',        imageUrl: SERVICE_LOGOS.vercel },
  { id: 'make',        name: 'Make Automatización',  category: 'Automatización', imageUrl: SERVICE_LOGOS.make },
  { id: 'nextdotjs',   name: 'Next.js Framework',    category: 'Hosting',        imageUrl: SERVICE_LOGOS.nextdotjs },
  { id: 'react',       name: 'React Frontend',       category: 'IA',             imageUrl: SERVICE_LOGOS.react },
];

const STEP_TABS = [
  { id: 'contenido', label: 'Contenido' },
  { id: 'script',    label: 'Script' },
  { id: 'audio',     label: 'Audio' },
  { id: 'visual',    label: 'Visual' },
];

const BG_THEMES = [
  { id: 'neon',    label: 'Neón',    colors: ['#8b5cf6', '#ec4899'] },
  { id: 'breeze',  label: 'Breeze',  colors: ['#0ea5e9', '#9333ea'] },
  { id: 'sunrise', label: 'Sunrise', colors: ['#facc15', '#fb923c'] },
  { id: 'vivid',   label: 'Vivid',   colors: ['#14b8a6', '#00bfff'] },
  { id: 'aurora',  label: 'Aurora',  colors: ['#a855f7', '#22d3ee'] },
];

const MOODS = [
  { id: 'upbeat',        label: 'Energético' },
  { id: 'chill',         label: 'Chill' },
  { id: 'corporate',     label: 'Corporativo' },
  { id: 'inspirational', label: 'Inspiracional' },
  { id: 'tech',          label: 'Tech' },
];

const TRAY_MAX = 10; // más de 4 partes — límite generoso, cuidando que el timeline siga siendo usable

// Construye clips[] a partir de una lista de fuentes {url, type} — punto único
// de entrada para todo lo que termina en el timeline (bandeja de 1 o varios
// items, y el modo "caso de éxito" que repite una misma imagen con títulos
// distintos). `perTitles`/`perSubs` (si vienen) le dan a cada clip su propio
// texto; si no, todos comparten `sharedTitle`/`sharedSub`. Cada clip es
// independiente: texto, duración, fuente y efecto de entrada propios.
function buildDefaultClips(sources, perTitles, perSubs, sharedTitle, sharedSub, totalDuration) {
  const list = (sources || []).filter((s) => s && s.url);
  if (list.length === 0) return [];
  const each = totalDuration / list.length;
  return list.map((src, i) => ({
    id: `clip-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    trayId: src.trayId || null, // liga el clip a su miniatura de la bandeja, aunque se reordene en el timeline
    type: src.type === 'video' ? 'video' : 'image',
    imageUrl: src.type === 'video' ? null : src.url,
    img: null,
    videoUrl: src.type === 'video' ? src.url : null,
    videoEl: null,
    videoVolume: 1,
    duration: each,
    title: perTitles ? (perTitles[i] || '') : (sharedTitle || 'Sin título'),
    subtitle: perSubs ? (perSubs[i] || '') : (sharedSub || ''),
    titleManuallyEdited: false, // true una vez que se edita a mano — evita que el sync global lo pise
    textX: 0.5,
    textY: 0.5,
    textScale: 1,
    textEffect: 'slideup',
    fontFamily: FONT_FAMILIES[0].css,
    transitionIn: i === 0 ? 'cut' : 'crossfade',
  }));
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CanvasReelGenerator() {
  // ── Contenido — bandeja de mezcla libre entre categorías ──
  const [activeCategory, setActiveCategory]   = useState('producto');
  const [products, setProducts]               = useState([]);
  const [projects, setProjects]               = useState([]);
  const [tray, setTray]                       = useState([]); // [{trayId, sourceCategory, sourceId, mediaType, mediaUrl, name, subtitleHint, raw}]
  const [uploadingMedia, setUploadingMedia]   = useState(null); // null | 'image' | 'video'
  const [selectedContent, setSelectedContent] = useState(null); // derivado de tray, ver efecto abajo
  const [rentalData, setRentalData]           = useState({});
  const [priceLabel, setPriceLabel]           = useState('');
  const [showPrice, setShowPrice]             = useState(false);

  // ── Clips — fuente de verdad del timeline ──
  const [clips, setClips]                     = useState([]);
  const [selectedClipId, setSelectedClipId]   = useState(null);
  const [currentTime, setCurrentTime]         = useState(0);
  const [isScrubbing, setIsScrubbing]         = useState(false);

  // ── Pestaña activa (Zona B) ──
  const [stepTab, setStepTab] = useState('contenido');

  // ── Script (paso 2) ──
  const [script, setScript]           = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState(null);

  // ── Audio (paso 3) — música vía Jamendo (catálogo real, gratis) ──
  const [mood, setMood]               = useState('upbeat');
  const [musicUrl, setMusicUrl]       = useState('');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicTracks, setMusicTracks] = useState([]);
  const [musicOffset, setMusicOffset] = useState(0);
  const [hasMoreMusic, setHasMoreMusic] = useState(false);
  const [musicQuery, setMusicQuery]   = useState('');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [previewingTrackId, setPreviewingTrackId] = useState(null);
  const [ttsBase64, setTtsBase64]     = useState('');
  const [ttsLoading, setTtsLoading]   = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.25);
  const [previewRef, setPreviewRef]   = useState(null);

  // ── Visual (paso 4) — ajustes globales del reel (el resto es por-clip, ver
  // ReelClipProperties: texto, fuente, efecto de entrada, duración, transición) ──
  const [bgColors, setBgColors]       = useState(BG_THEMES[0].colors);
  const [bgMode, setBgMode]           = useState('duo'); // 'duo' (2 colores) | 'tri' (3 colores)
  const [grainIntensity, setGrainIntensity] = useState(0);
  const [blurAmount, setBlurAmount]   = useState(0);
  const [duration, setDuration]       = useState(30);
  const [customMainText, setCustomMainText] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');

  // ── Grabación ──
  const [isRecording, setIsRecording]     = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [isUploading, setIsUploading]     = useState(false);
  const [videoUrl, setVideoUrl]           = useState(null);
  const [error, setError]                 = useState(null);

  const canvasRef        = useRef(null);
  const previewWrapperRef = useRef(null);
  const textDragRef      = useRef(null);
  const trayDragRef      = useRef(null);
  const videoElsRef      = useRef(new Map()); // id de clip -> <video> de preview, para liberar los que ya no están
  const exchangeService  = new ExchangeService();

  const totalDuration = useMemo(() => clips.reduce((a, c) => a + (c.duration || 0), 0), [clips]);
  const selectedClip  = clips.find((c) => c.id === selectedClipId) || null;

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    setProducts([]);
  }, []);

  useEffect(() => {
    fetch('/api/proyectos')
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : d?.proyectos || []))
      .catch(() => {});
  }, []);

  // Carga las fuentes disponibles vía Google Fonts (una sola vez) — el motor
  // de canvas usa lo que esté cargado en la página vía CSS/@font-face.
  useEffect(() => {
    const families = FONT_FAMILIES.map((f) => `family=${f.google}`).join('&');
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, []);

  // Bitono (2 colores) / Tritono (3 colores) para el fondo — al cambiar de
  // modo agrega o recorta el color que falte/sobra sin perder los ya elegidos.
  function handleSetBgMode(mode) {
    setBgMode(mode);
    setBgColors((prev) => {
      if (mode === 'tri' && prev.length < 3) return [...prev, '#0f0f1a'];
      if (mode === 'duo' && prev.length > 2) return prev.slice(0, 2);
      return prev;
    });
  }

  // ── Bandeja: agregar / sacar / tildar ───────────────────────────────────────
  function isInTray(sourceCategory, sourceId) {
    return tray.some((t) => t.sourceCategory === sourceCategory && t.sourceId === sourceId);
  }

  function handleToggleItem(item) {
    setTray((prev) => {
      const existingIdx = prev.findIndex((t) => t.sourceCategory === item.sourceCategory && t.sourceId === item.sourceId);
      if (existingIdx >= 0) return prev.filter((_, i) => i !== existingIdx);
      if (prev.length >= TRAY_MAX) return prev;
      // Herramientas no tienen screenshot propio — se genera un placeholder canvas.
      const mediaUrl = item.mediaUrl || (item.sourceCategory === 'herramienta'
        ? getToolPlaceholderDataUrl(item.raw, item.toolIndex || 0)
        : null);
      if (!mediaUrl) return prev;
      return [...prev, { ...item, mediaUrl, trayId: `tray-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
    });
  }

  function removeFromTray(trayId) {
    setTray((prev) => prev.filter((t) => t.trayId !== trayId));
  }

  async function handleUploadImage(file) {
    setUploadingMedia('image');
    try {
      const base64 = await fileToBase64(file);
      const url = await cloudinaryService.uploadBase64Image(base64, 'reel-uploads');
      setTray((prev) => (prev.length >= TRAY_MAX ? prev : [...prev, {
        trayId: `tray-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceCategory: 'upload', sourceId: `upload-img-${Date.now()}`, mediaType: 'image',
        mediaUrl: url, name: 'Imagen propia', subtitleHint: '', raw: null,
      }]));
    } catch (e) {
      setError(`Error subiendo imagen: ${e.message}`);
    } finally {
      setUploadingMedia(null);
    }
  }

  async function handleUploadVideo(file) {
    setUploadingMedia('video');
    try {
      const base64 = await fileToBase64(file);
      const url = await cloudinaryService.uploadBase64Video(base64, 'reel-uploads');
      setTray((prev) => (prev.length >= TRAY_MAX ? prev : [...prev, {
        trayId: `tray-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceCategory: 'upload', sourceId: `upload-vid-${Date.now()}`, mediaType: 'video',
        mediaUrl: url, name: 'Video propio', subtitleHint: '', raw: null,
      }]));
    } catch (e) {
      setError(`Error subiendo video: ${e.message}`);
    } finally {
      setUploadingMedia(null);
    }
  }

  // Deriva un `selectedContent` con la misma forma de siempre a partir de la
  // bandeja — así toda la lógica existente (precio, alquiler, caso de éxito,
  // payload del script) sigue funcionando sin cambios, sea 1 item o varios de
  // categorías distintas.
  useEffect(() => {
    if (tray.length === 0) { setSelectedContent(null); return; }
    if (tray.length === 1) {
      const single = tray[0];
      setSelectedContent({ ...(single.raw || {}), type: single.sourceCategory, name: single.name });
    } else {
      setSelectedContent({
        type: 'mixed',
        multi: true,
        items: tray.map((t) => t.raw || { name: t.name, category: t.sourceCategory }),
        name: `${tray.length} items combinados`,
        titles: tray.map((t) => t.name),
        subtitles: tray.map((t) => t.subtitleHint || ''),
      });
    }
    setVideoUrl(null);
    setError(null);
  }, [tray]);

  // Reconstruye clips[] desde cero — SOLO cuando cambia la membresía de la
  // bandeja (agregar/sacar un item), no en cada tecla que se tipea en el título
  // custom (eso lo maneja el efecto de "sync de título" más abajo, que solo
  // pisa texto sin tocar duración/posición/transición ya ajustadas a mano).
  useEffect(() => {
    if (tray.length === 0) { setClips([]); return; }
    const sources = tray.map((t) => ({ url: t.mediaUrl, type: t.mediaType, trayId: t.trayId }));
    const isMulti = tray.length > 1;
    const perTitles = isMulti ? tray.map((t) => t.name) : null;
    const perSubs   = isMulti ? tray.map((t) => t.subtitleHint || '') : null;
    setClips(buildDefaultClips(sources, perTitles, perSubs, tray[0]?.name, tray[0]?.subtitleHint || '', duration));
    setSelectedClipId(null);
    setIsScrubbing(false);
    setScript('');
    setTtsBase64('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tray]);

  // Enriquecer con rental
  useEffect(() => {
    if (!selectedContent || selectedContent.type !== 'producto') return;
    const renta = rentalData[selectedContent.id] || rentalData[selectedContent.productoId];
    if (renta && selectedContent.rental?.seña !== renta.seña)
      setSelectedContent((prev) => ({ ...prev, rental: renta }));
  }, [rentalData, selectedContent]);

  // Precio ARS
  useEffect(() => {
    if (!selectedContent) { setPriceLabel(''); return; }
    if (selectedContent.priceUSD) {
      exchangeService.convertUsdToArs(selectedContent.priceUSD)
        .then((ars) => setPriceLabel(`Desde ${formatARS(ars)} (USD ${selectedContent.priceUSD})`))
        .catch(() => setPriceLabel(`Desde ${formatUSD(selectedContent.priceUSD)}`));
    } else if (selectedContent.priceARS) {
      setPriceLabel(`Desde ${formatARS(selectedContent.priceARS)}`);
    } else if (selectedContent.price) {
      setPriceLabel(`Desde ${formatARS(selectedContent.price)}`);
    } else {
      setPriceLabel('Precio a consultar');
    }
  }, [selectedContent]);

  // Mantiene sincronizado el título/subtítulo COMPARTIDO en modo single (no
  // multi) contra los inputs custom / precio — pisa solo texto en cada clip,
  // preserva duración/posición/transición ya ajustados a mano.
  useEffect(() => {
    if (!selectedContent || selectedContent.multi) return;
    const isProducto = selectedContent?.type === 'producto';
    const rental = selectedContent?.rental;
    const storeText = isProducto
      ? (showPrice && priceLabel
          ? priceLabel
          : (rental ? 'Precio · Compra o alquiler en la tienda' : 'Precio y formas de pago en la tienda'))
      : '';
    const sharedTitle = customMainText || selectedContent?.name || selectedContent?.sitio || 'Sin título';
    const sharedSub   = [customSubtitle || storeText].filter(Boolean).join(' · ');
    // No pisa clips que el usuario ya editó a mano en ReelClipProperties.
    setClips((prev) => prev.map((c) => (c.titleManuallyEdited ? c : { ...c, title: sharedTitle, subtitle: sharedSub })));
  }, [customMainText, customSubtitle, showPrice, priceLabel, selectedContent]);

  // Mantiene selectedClipId apuntando a un clip real.
  useEffect(() => {
    if (clips.length === 0) { setSelectedClipId(null); return; }
    if (!clips.some((c) => c.id === selectedClipId)) setSelectedClipId(clips[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  // Carga las imágenes de los clips — keyeado por el SET de URLs (no por
  // `clips` completo) para no relanzar en cada reorder/ajuste de duración, y
  // mergeado por URL para que reordenar o repetir una URL no rompa nada.
  const imageUrlsKey = useMemo(
    () => [...new Set(clips.filter((c) => c.type === 'image').map((c) => c.imageUrl).filter(Boolean))].sort().join('|'),
    [clips]
  );
  useEffect(() => {
    const urls = imageUrlsKey ? imageUrlsKey.split('|') : [];
    if (urls.length === 0) return;
    let cancelled = false;
    canvasReelService.loadImages(urls).then((imgs) => {
      if (cancelled) return;
      const map = {};
      urls.forEach((u, i) => { if (imgs[i]) map[u] = imgs[i]; });
      setClips((prev) => prev.map((c) => (c.type === 'image' && map[c.imageUrl] ? { ...c, img: map[c.imageUrl] } : c)));
    });
    return () => { cancelled = true; };
  }, [imageUrlsKey]);

  // Crea un <video> de PREVIEW por cada clip de video (record() crea los suyos
  // propios aparte, ver canvasReelService). Keyeado por id de clip, no por URL
  // — dos clips pueden compartir el mismo video fuente y necesitan su propio
  // estado de reproducción independiente.
  const videoClipsKey = useMemo(
    () => clips.filter((c) => c.type === 'video' && c.videoUrl).map((c) => `${c.id}:${c.videoUrl}`).join('|'),
    [clips]
  );
  useEffect(() => {
    if (!videoClipsKey) return;
    setClips((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        if (c.type === 'video' && c.videoUrl && !c.videoEl) {
          const el = document.createElement('video');
          el.crossOrigin = 'anonymous';
          el.muted = true; // arranca mudo — _syncVideoClips lo destapea al activarse en preview
          el.loop = true;
          el.playsInline = true;
          el.preload = 'auto';
          el.src = c.videoUrl;
          videoElsRef.current.set(c.id, el);
          changed = true;
          return { ...c, videoEl: el };
        }
        return c;
      });
      return changed ? next : prev;
    });
  }, [videoClipsKey]);

  // Libera los <video> de preview de clips que ya no existen (sacados/reemplazados).
  useEffect(() => {
    const currentIds = new Set(clips.filter((c) => c.type === 'video').map((c) => c.id));
    videoElsRef.current.forEach((el, id) => {
      if (!currentIds.has(id)) {
        try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* noop */ }
        videoElsRef.current.delete(id);
      }
    });
  }, [clips]);

  // Preview canvas — se saltea mientras se está scrubbeando/editando en pausa.
  useEffect(() => {
    if (!canvasRef.current || !selectedContent || isScrubbing) return;
    canvasReelService.startPreview(canvasRef.current, buildConfig());
    return () => canvasReelService.stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContent, duration, clips, bgColors, grainIntensity, blurAmount, showPrice, priceLabel, isScrubbing]);

  // Mood → índice en MUSIC_TRACKS (fallback Cloudinary con CORS garantizado)
  const MOOD_TRACK = { upbeat: 0, chill: 1, tech: 2, corporate: 3, inspirational: 4 };

  function buildConfig(clipsOverride) {
    // Si el usuario no seleccionó un track de Jamendo, usar el de Cloudinary
    // que corresponde al mood elegido — garantiza que siempre haya música.
    const fallbackMusicUrl = MUSIC_TRACKS[MOOD_TRACK[mood] ?? 0]?.url || '';
    return {
      clips: clipsOverride || clips,
      musicUrl: musicUrl || fallbackMusicUrl,
      ttsBase64:   voiceEnabled ? ttsBase64 : '',
      voiceVolume,
      musicVolume,
      contentType: selectedContent?.type || 'default',
      bgColors,
      grainIntensity,
      blurAmount,
    };
  }

  // Punto único de mutación de `clips`: si está pausado editando (isScrubbing),
  // repinta el frame estático de una con el resultado.
  function mutateClips(updaterFn) {
    setClips((prev) => {
      const next = updaterFn(prev);
      if (isScrubbing && canvasRef.current) {
        canvasReelService.drawFrameAt(canvasRef.current, buildConfig(next), currentTime);
      }
      return next;
    });
  }

  function updateClip(clipId, patch) {
    mutateClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, ...patch } : c)));
  }

  function handleReorderClips(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    mutateClips((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  function handleResizeClipDuration(clipId, rawDuration) {
    mutateClips((prev) => {
      const idx = prev.findIndex((c) => c.id === clipId);
      if (idx < 0) return prev;
      const clamped = Math.max(MIN_CLIP_DURATION, rawDuration);
      const nextIdx = idx + 1;
      if (nextIdx >= prev.length) {
        return prev.map((c, i) => (i === idx ? { ...c, duration: clamped } : c));
      }
      const delta = clamped - prev[idx].duration;
      const neighborClamped = Math.max(MIN_CLIP_DURATION, prev[nextIdx].duration - delta);
      const actualDelta = prev[nextIdx].duration - neighborClamped;
      return prev.map((c, i) => {
        if (i === idx) return { ...c, duration: prev[idx].duration + actualDelta };
        if (i === nextIdx) return { ...c, duration: neighborClamped };
        return c;
      });
    });
  }

  function handleSetDuration(newTotal) {
    setDuration(newTotal);
    mutateClips((prev) => {
      if (prev.length === 0) return prev;
      const oldTotal = prev.reduce((a, c) => a + c.duration, 0) || newTotal;
      const k = newTotal / oldTotal;
      return prev.map((c) => ({ ...c, duration: Math.max(MIN_CLIP_DURATION, c.duration * k) }));
    });
  }

  // ── Timeline: selección, scrub y pausa para edición ─────────────────────────
  function handleSelectClipFromTimeline(clipId) {
    setSelectedClipId(clipId);
    const idx = clips.findIndex((c) => c.id === clipId);
    if (idx < 0) return;
    const offset = clips.slice(0, idx).reduce((a, c) => a + c.duration, 0);
    setIsScrubbing(true);
    canvasReelService.stopPreview();
    setCurrentTime(offset);
    if (canvasRef.current) canvasReelService.drawFrameAt(canvasRef.current, buildConfig(), offset);
  }

  // Clickear una miniatura de la bandeja selecciona su clip correspondiente —
  // se busca por trayId (no por índice) porque reordenar en el timeline puede
  // dejar el orden de los clips distinto al orden de la bandeja.
  function handleSelectClipFromTray(trayId) {
    const clip = clips.find((c) => c.trayId === trayId);
    if (clip) handleSelectClipFromTimeline(clip.id);
  }

  // Arrastrar una miniatura de la bandeja reordena el clip correspondiente —
  // reusa handleReorderClips (mismo mecanismo que arrastrar en el timeline),
  // así la bandeja y el timeline nunca quedan desincronizados.
  function handleTrayPointerDown(clipIdx) {
    return (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      trayDragRef.current = { fromClipIdx: clipIdx };
    };
  }
  function handleTrayPointerMove(e) {
    if (!trayDragRef.current) return;
    // El listener está en el contenedor (no en cada botón), así que
    // e.currentTarget YA es el contenedor de todas las miniaturas.
    const blocks = e.currentTarget.querySelectorAll('[data-tray-idx]');
    for (const el of blocks) {
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const overIdx = Number(el.dataset.trayIdx);
      const from = trayDragRef.current.fromClipIdx;
      if (overIdx === from) break;
      handleReorderClips(from, overIdx);
      trayDragRef.current.fromClipIdx = overIdx;
      break;
    }
  }
  function handleTrayPointerUp() {
    trayDragRef.current = null;
  }

  function handleScrubStart() {
    setIsScrubbing(true);
    canvasReelService.stopPreview();
  }

  function handleScrub(time) {
    setCurrentTime(time);
    if (canvasRef.current) canvasReelService.drawFrameAt(canvasRef.current, buildConfig(), time);
  }

  function handleResumePreview() {
    setIsScrubbing(false);
  }

  // ── Overlay de texto arrastrable sobre el preview ──────────────────────────
  function handleTextPointerDown(e) {
    if (!selectedClip) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    textDragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startTextX: selectedClip.textX ?? 0.5, startTextY: selectedClip.textY ?? 0.5,
    };
  }
  function handleTextPointerMove(e) {
    if (!textDragRef.current || !selectedClip || !previewWrapperRef.current) return;
    const rect = previewWrapperRef.current.getBoundingClientRect();
    const dx = (e.clientX - textDragRef.current.startX) / rect.width;
    const dy = (e.clientY - textDragRef.current.startY) / rect.height;
    const nx = Math.min(0.95, Math.max(0.05, textDragRef.current.startTextX + dx));
    const ny = Math.min(0.95, Math.max(0.05, textDragRef.current.startTextY + dy));
    updateClip(selectedClip.id, { textX: nx, textY: ny });
  }
  function handleTextPointerUp() {
    textDragRef.current = null;
  }

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;

  // ── Script ────────────────────────────────────────────────────────────────
  async function handleGenerateScript() {
    if (!selectedContent) return;
    setScriptLoading(true);
    setScriptError(null);
    try {
      const res  = await fetch('/api/reel-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType:        selectedContent.type || 'producto',
          contentName:        selectedContent.name || selectedContent.sitio || '',
          contentDescription: selectedContent.shortDescription || selectedContent.description || selectedContent.descripcionCorta || '',
          items: selectedContent.multi
            ? selectedContent.items.map((it) => ({ name: it.name || it.domain, description: it.shortDescription || it.description || it.category || '' }))
            : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScript(data.script || '');
      setTtsBase64('');
    } catch (e) {
      setScriptError(e.message);
    } finally {
      setScriptLoading(false);
    }
  }

  // Caso de éxito: arma 4 slides (problema → solución → impacto → CTA) a partir
  // de los datos reales del proyecto. Reusa buildDefaultClips repitiendo la
  // misma captura 4 veces con títulos distintos.
  const canCaseStudy = activeCategory === 'proyecto' && selectedContent && !selectedContent.multi
    && (selectedContent.descripcionCorta || selectedContent.impacto || selectedContent.funcionalidades);

  async function handleGenerateCaseStudy() {
    if (!selectedContent) return;
    setScriptLoading(true);
    setScriptError(null);
    try {
      const res = await fetch('/api/reel-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'caso-exito',
          proyecto: {
            name: selectedContent.name || selectedContent.domain || '',
            descripcionCorta: selectedContent.descripcionCorta || '',
            funcionalidades: selectedContent.funcionalidades || '',
            impacto: selectedContent.impacto || '',
            stack: selectedContent.stack || '',
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setScript(data.script || '');
      setTtsBase64('');

      const slides = data.slides || [];
      const shot = clips.find((c) => c.type === 'image')?.imageUrl;
      setSelectedContent((prev) => ({
        ...prev,
        multi: true,
        titles: slides.map((s) => s.title || ''),
        subtitles: slides.map((s) => s.subtitle || ''),
      }));
      if (shot && slides.length > 0) {
        setClips(buildDefaultClips(
          Array(slides.length).fill({ url: shot, type: 'image' }),
          slides.map((s) => s.title), slides.map((s) => s.subtitle), null, null, duration
        ));
      }
    } catch (e) {
      setScriptError(e.message);
    } finally {
      setScriptLoading(false);
    }
  }

  // ── Música — catálogo real vía Jamendo (gratis, buscable) ──────────────────
  async function loadMusicTracks({ append = false, moodOverride, queryOverride } = {}) {
    const useMood = moodOverride !== undefined ? moodOverride : mood;
    const useQuery = queryOverride !== undefined ? queryOverride : musicQuery;
    const offset = append ? musicOffset : 0;
    setMusicLoading(true);
    try {
      const params = new URLSearchParams({ mood: useMood, offset: String(offset) });
      if (useQuery.trim()) params.set('q', useQuery.trim());
      const res = await fetch(`/api/reel-music-jamendo?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newTracks = data.tracks || [];
      setMusicTracks((prev) => (append ? [...prev, ...newTracks] : newTracks));
      setMusicOffset(offset + newTracks.length);
      setHasMoreMusic(newTracks.length === 20);
    } catch {
      if (!append) setMusicTracks([]);
    } finally {
      setMusicLoading(false);
    }
  }

  function handleLoadMusic(selectedMood) {
    setMood(selectedMood);
    setSelectedTrack(null);
    setMusicUrl('');
    loadMusicTracks({ moodOverride: selectedMood, queryOverride: '' });
    setMusicQuery('');
  }

  function handleSearchMusic() {
    setSelectedTrack(null);
    loadMusicTracks({ queryOverride: musicQuery });
  }

  function selectTrack(track) {
    setSelectedTrack(track);
    setMusicUrl(track.audioUrl);
  }

  function previewTrack(track) {
    if (previewRef) { try { previewRef.source?.stop(); previewRef.audioCtx?.close(); } catch {} }
    if (previewingTrackId === track.id) { setPreviewingTrackId(null); return; }
    const audio = new Audio(track.audioUrl);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audio.onended = () => setPreviewingTrackId(null);
    setPreviewRef({ source: { stop: () => audio.pause() }, audioCtx: null });
    setPreviewingTrackId(track.id);
  }

  // ── Voz ───────────────────────────────────────────────────────────────────
  async function handleGenerateTTS() {
    if (!script) return;
    setTtsLoading(true);
    try {
      const res  = await fetch('/api/reel-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTtsBase64(data.audioBase64 || '');
    } catch (e) {
      setError(`TTS: ${e.message}`);
    } finally {
      setTtsLoading(false);
    }
  }

  async function handlePreviewVoice() {
    if (!ttsBase64) return;
    if (previewRef) { try { previewRef.source?.stop(); previewRef.audioCtx?.close(); } catch {} }
    const ref = await canvasReelService.playAudioPreview(ttsBase64, true);
    setPreviewRef(ref);
  }

  // ── Grabar ────────────────────────────────────────────────────────────────
  const handleRecord = async () => {
    if (!selectedContent || clips.length === 0 || isRecording || isUploading) return;
    setError(null);
    setVideoUrl(null);
    setIsRecording(true);
    setRecordProgress(0);
    canvasReelService.stopPreview();

    try {
      const blob = await canvasReelService.record(buildConfig(), setRecordProgress);
      setIsRecording(false);
      setIsUploading(true);

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
      const cloudForm = new FormData();
      cloudForm.append('file', blob, 'reel.webm');
      cloudForm.append('upload_preset', 'portfolio_reels');
      cloudForm.append('folder', 'reels');

      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
        method: 'POST',
        body: cloudForm,
      });
      if (!cloudRes.ok) throw new Error(`Cloudinary error ${cloudRes.status}: ${await cloudRes.text()}`);

      const { secure_url: uploadedUrl } = await cloudRes.json();
      const mp4Url = uploadedUrl
        .replace('/upload/', '/upload/f_mp4,vc_h264,ac_aac/')
        .replace(/\.webm$/, '.mp4');

      const productId   = selectedContent.id || selectedContent.sitio || 'reel';
      const productName = selectedContent.name || selectedContent.sitio || productId;
      const cfg         = buildConfig();

      const res  = await fetch('/api/upload-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl:   mp4Url,
          productId,
          text:       script || productName,
          subtitle:   cfg.clips?.[0]?.subtitle || '',
          aiProvider: 'gemini',
          useAI:      true,
          type:       'reel',
        }),
      });
      const data = await res.json();
      if (!data.videoUrl) throw new Error(data.error || 'Error notificando Make.com');
      setVideoUrl(data.videoUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsRecording(false);
      setIsUploading(false);
      setIsScrubbing(false);
      if (canvasRef.current && selectedContent)
        canvasReelService.startPreview(canvasRef.current, buildConfig());
    }
  };

  const busy      = isRecording || isUploading;
  const busyLabel = isRecording
    ? `Grabando… ${Math.round(recordProgress * 100)}%`
    : isUploading ? 'Subiendo a Cloudinary…' : '🎬 Grabar reel';

  // ── UI — 3 zonas: preview+propiedades arriba, pasos al medio, timeline abajo ─
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">Generador de reels (Canvas)</h2>

      {/* ── Zona A: preview + bandeja + propiedades del clip ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Preview 9:16</p>
          <div ref={previewWrapperRef} className="relative" style={{ width: 270, height: 480 }}>
            <canvas
              ref={canvasRef}
              width={270}
              height={480}
              className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-black"
            />
            {isScrubbing && selectedClip && (
              <div
                onPointerDown={handleTextPointerDown}
                onPointerMove={handleTextPointerMove}
                onPointerUp={handleTextPointerUp}
                title="Arrastrá para mover el título"
                className="absolute w-24 h-10 border-2 border-dashed border-indigo-400 bg-indigo-500/10 rounded cursor-move flex items-center justify-center"
                style={{
                  left: `${(selectedClip.textX ?? 0.5) * 100}%`,
                  top: `${(selectedClip.textY ?? 0.5) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  touchAction: 'none',
                }}
              >
                <span className="text-[9px] text-indigo-200 font-semibold pointer-events-none">Título</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 text-center max-w-[270px]">
            La grabación renderiza a 1080×1920.
          </p>
        </div>

        <div className="space-y-3">
          {/* Bandeja */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Bandeja ({tray.length}/{TRAY_MAX})
            </p>
            {tray.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-4 text-center">
                Vacía — elegí productos, tecnologías, proyectos, herramientas o subí tu propia imagen/video en la pestaña &quot;Contenido&quot;.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap" onPointerMove={handleTrayPointerMove} onPointerUp={handleTrayPointerUp}>
                {/* Orden derivado de `clips` (no de `tray`) — así la bandeja
                    siempre refleja el orden real del reel, sea que se haya
                    reordenado acá o en el timeline. */}
                {clips.map((clip, idx) => {
                  const t = tray.find((x) => x.trayId === clip.trayId);
                  if (!t) return null;
                  const isSelected = clip.id === selectedClipId;
                  return (
                    <button key={t.trayId} type="button" data-tray-idx={idx}
                      onPointerDown={handleTrayPointerDown(idx)}
                      onClick={() => handleSelectClipFromTray(t.trayId)}
                      title="Arrastrar para reordenar — click para editar"
                      style={{ touchAction: 'none' }}
                      className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
                        isSelected ? 'border-white ring-2 ring-indigo-400 scale-105' : 'border-indigo-500 hover:border-indigo-300'
                      }`}
                    >
                      {t.mediaType === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-indigo-400 text-white text-lg">▶</div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.mediaUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      )}
                      <span className="absolute top-0 left-0.5 text-[8px] text-white/80 font-bold">{idx + 1}</span>
                      <span
                        role="button" tabIndex={0}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); removeFromTray(t.trayId); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeFromTray(t.trayId); } }}
                        className="absolute top-0 right-0 w-4 h-4 bg-black/70 hover:bg-red-600 text-white text-[10px] flex items-center justify-center rounded-bl cursor-pointer"
                      >✕</span>
                      <span className="absolute bottom-0 inset-x-0 text-[8px] text-white bg-black/60 px-1 truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <ReelClipProperties
            clip={selectedClip}
            onUpdateClip={(patch) => selectedClip && updateClip(selectedClip.id, patch)}
            isScrubbing={isScrubbing}
            onResumePreview={handleResumePreview}
          />
        </div>
      </div>

      {/* ── Zona B: pasos como pestañas ── */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-neutral-800">
          {STEP_TABS.map((t) => (
            <button key={t.id} onClick={() => setStepTab(t.id)}
              className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                stepTab === t.id
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >{t.label}</button>
          ))}
        </div>

        <div className="p-4">
          {/* ── Contenido ── */}
          {stepTab === 'contenido' && (
            <div className="space-y-3">
              <ReelContentPicker
                activeCategory={activeCategory}
                onActiveCategoryChange={setActiveCategory}
                products={products}
                techItems={TECH_ITEMS}
                projects={projects}
                tools={TOOLS}
                tray={tray}
                onToggleItem={handleToggleItem}
                maxItems={TRAY_MAX}
                onUploadImage={handleUploadImage}
                onUploadVideo={handleUploadVideo}
                uploadingMedia={uploadingMedia}
              />

              {selectedContent && !selectedContent.multi && (
                <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-neutral-800 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Item: </span>
                      <span className="text-gray-900 dark:text-white font-semibold">{selectedContent.name || selectedContent.sitio}</span>
                      {priceLabel && selectedContent.type === 'producto' && <div className="text-green-600 dark:text-green-400 font-semibold mt-0.5">{priceLabel}</div>}
                      {selectedContent.rental && (
                        <div className="text-gray-600 dark:text-gray-300 mt-0.5">
                          Alquiler: seña ${selectedContent.rental.seña} · cuota ${selectedContent.rental.cuota}/mes · mín {selectedContent.rental.duracionMinima}m
                        </div>
                      )}
                    </div>
                    {selectedContent.type === 'producto' && priceLabel && (
                      <button
                        onClick={() => setShowPrice((v) => !v)}
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          showPrice ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >{showPrice ? 'Precio: SÍ' : 'Precio: NO'}</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Script ── */}
          {stepTab === 'script' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={handleGenerateScript} disabled={!selectedContent || scriptLoading}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                >{scriptLoading ? 'Generando…' : 'Generar script con Gemini'}</button>
                {script && (
                  <button onClick={handleGenerateScript} disabled={scriptLoading}
                    className="px-3 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm transition-colors"
                    title="Regenerar"
                  >Regenerar</button>
                )}
              </div>

              {canCaseStudy && (
                <button onClick={handleGenerateCaseStudy} disabled={scriptLoading}
                  title="Arma 4 slides (problema → solución → impacto → CTA) con los datos reales del proyecto"
                  className="w-full py-2 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                >{scriptLoading ? 'Generando…' : 'Armar caso de éxito (problema → solución → impacto)'}</button>
              )}

              {scriptError && <p className="text-red-600 dark:text-red-400 text-xs">{scriptError}</p>}

              {selectedContent?.multi && selectedContent?.titles?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 space-y-1">
                  {selectedContent.titles.map((t, i) => (
                    <p key={i} className="text-xs text-amber-800 dark:text-amber-300">
                      <span className="font-bold">{i + 1}.</span> {t}
                      {selectedContent.subtitles?.[i] && <span className="text-amber-600 dark:text-amber-500"> — {selectedContent.subtitles[i]}</span>}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <textarea
                  value={script}
                  onChange={(e) => { setScript(e.target.value); setTtsBase64(''); }}
                  rows={4}
                  placeholder="El script aparecerá aquí — podés editarlo antes de grabar"
                  className="w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className={`text-xs text-right ${wordCount > 60 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{wordCount}/60 palabras</div>
              </div>
            </div>
          )}

          {/* ── Audio ── */}
          {stepTab === 'audio' && (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Estilo (catálogo Jamendo, gratis)</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 mb-2">
                  {MOODS.map((m) => (
                    <button key={m.id} onClick={() => handleLoadMusic(m.id)} disabled={musicLoading}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                        mood === m.id && !musicQuery
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >{m.label}</button>
                  ))}
                </div>

                <div className="flex gap-1.5 mb-2">
                  <input value={musicQuery} onChange={(e) => setMusicQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()}
                    placeholder="Buscar por nombre o artista…"
                    className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button onClick={handleSearchMusic} disabled={musicLoading}
                    className="px-3 py-1.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >Buscar</button>
                </div>

                {musicLoading && musicTracks.length === 0 && <p className="text-xs text-gray-400">Cargando música…</p>}

                {musicTracks.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-neutral-800 rounded-xl p-1.5">
                    {musicTracks.map((t) => (
                      <div key={t.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedTrack?.id === t.id
                            ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <button onClick={() => previewTrack(t)} className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
                          {previewingTrackId === t.id ? '⏸' : '▶'}
                        </button>
                        <button onClick={() => selectTrack(t)} className="flex-1 text-left truncate">
                          <span className="font-medium">{t.nombre}</span>
                          <span className="text-gray-400"> — {t.artista}</span>
                        </button>
                        {selectedTrack?.id === t.id && <span className="shrink-0 text-indigo-600 dark:text-indigo-400">✓</span>}
                      </div>
                    ))}
                    {hasMoreMusic && (
                      <button onClick={() => loadMusicTracks({ append: true })} disabled={musicLoading}
                        className="w-full text-center text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 py-1 disabled:opacity-50"
                      >{musicLoading ? 'Cargando…' : 'Cargar más ↓'}</button>
                    )}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20 shrink-0">Volumen música</span>
                  <input type="range" min="0" max="1" step="0.05" value={musicVolume}
                    onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                  <span className="text-xs text-gray-400 w-8 text-right">{Math.round(musicVolume * 100)}%</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Voz (Google TTS)</p>
                  <button onClick={() => setVoiceEnabled((v) => !v)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      voiceEnabled ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >{voiceEnabled ? 'Activada' : 'Desactivada'}</button>
                </div>

                {voiceEnabled && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button onClick={handleGenerateTTS} disabled={!script || ttsLoading}
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                      >{ttsLoading ? 'Generando voz…' : ttsBase64 ? 'Voz generada — Regenerar' : 'Generar voz'}</button>
                      {ttsBase64 && (
                        <button onClick={handlePreviewVoice}
                          className="px-3 py-1.5 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs transition-colors"
                        >Escuchar</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20 shrink-0">Volumen voz</span>
                      <input type="range" min="0" max="1" step="0.05" value={voiceVolume}
                        onChange={(e) => setVoiceVolume(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                      <span className="text-xs text-gray-400 w-8 text-right">{Math.round(voiceVolume * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Visual ── */}
          {stepTab === 'visual' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Fondo — presets rápidos</p>
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                    {[['duo', 'Bitono'], ['tri', 'Tritono']].map(([id, label]) => (
                      <button key={id} onClick={() => handleSetBgMode(id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          bgMode === id ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {BG_THEMES.map((theme) => (
                    <button key={theme.id}
                      onClick={() => { setBgColors(bgMode === 'tri' ? [...theme.colors, bgColors[2] || '#0f0f1a'] : theme.colors); }}
                      className="relative h-9 rounded-lg transition-all opacity-80 hover:opacity-100 hover:scale-105"
                      style={{ background: `linear-gradient(135deg, ${theme.colors[0]} 0%, ${theme.colors[1]} 100%)` }}
                      title={theme.label}
                    ><span className="sr-only">{theme.label}</span></button>
                  ))}
                </div>
                {/* Colores custom — 2 (bitono) o 3 (tritono) según el modo */}
                <div className="flex items-center gap-2">
                  {bgColors.map((c, i) => (
                    <input key={i} type="color" value={c}
                      onChange={(e) => setBgColors((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                      className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 dark:border-neutral-700 bg-transparent"
                    />
                  ))}
                  <div className="flex-1 h-9 rounded-lg" style={{ background: `linear-gradient(135deg, ${bgColors.join(', ')})` }} />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Grano (textura fílmica)</p>
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="1" step="0.05" value={grainIntensity}
                    onChange={(e) => setGrainIntensity(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                  <span className="text-xs text-gray-400 w-9 text-right">{Math.round(grainIntensity * 100)}%</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Difuminado del fondo (blur)</p>
                <div className="flex items-center gap-2">
                  <input type="range" min="0" max="20" step="1" value={blurAmount}
                    onChange={(e) => setBlurAmount(parseInt(e.target.value, 10))} className="flex-1 accent-indigo-500" />
                  <span className="text-xs text-gray-400 w-9 text-right">{blurAmount}px</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Texto, fuente, efecto de entrada y transición ahora se configuran por clip — seleccioná uno en el timeline y editalo en el panel de arriba.
              </p>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Duración total</p>
                <div className="flex gap-2 items-center">
                  {[15, 30].map((d) => (
                    <button key={d} onClick={() => handleSetDuration(d)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        duration === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >{d}s</button>
                  ))}
                  <span className="text-xs text-gray-500 ml-2">Actual: {totalDuration.toFixed(1)}s</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input value={customMainText} onChange={(e) => setCustomMainText(e.target.value)}
                  placeholder="Título (opcional)"
                  className="text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input value={customSubtitle} onChange={(e) => setCustomSubtitle(e.target.value)}
                  placeholder="Subtitle (opcional)"
                  className="text-xs rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Zona C: timeline ancho completo + grabar ── */}
      {clips.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1">
            <ReelTimeline
              clips={clips}
              selectedClipId={selectedClipId}
              currentTime={currentTime}
              totalDuration={totalDuration}
              onSelectClip={handleSelectClipFromTimeline}
              onReorder={handleReorderClips}
              onResizeDuration={handleResizeClipDuration}
              onScrubStart={handleScrubStart}
              onScrub={handleScrub}
              onScrubEnd={() => {}}
            />
          </div>
          <button onClick={handleRecord} disabled={!selectedContent || clips.length === 0 || busy}
            className="shrink-0 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >{busyLabel}</button>
        </div>
      )}

      {busy && (
        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div className="h-full bg-indigo-600"
            animate={{ width: `${Math.round(recordProgress * 100)}%` }} transition={{ duration: 0.1 }} />
        </div>
      )}

      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3">{error}</p>
      )}

      {videoUrl && (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4 space-y-1">
          <p className="text-green-700 dark:text-green-400 font-semibold text-sm">Video listo — Make.com notificado</p>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 text-xs break-all hover:underline">{videoUrl}</a>
        </div>
      )}
    </div>
  );
}
