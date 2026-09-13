'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { canvasReelService, TEXT_EFFECTS, CLIP_TRANSITIONS, MIN_CLIP_DURATION } from '../../utils/canvasReelService';
import ReelTimeline from './ReelTimeline';
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

const TABS = [
  { id: 'producto',   label: '🛍️ Producto' },
  { id: 'tecnologia', label: '⚙️ Tecnología' },
  { id: 'proyecto',   label: '📊 Proyecto' },
];

const BG_THEMES = [
  { id: 'neon',    label: 'Neón',    colors: ['#8b5cf6', '#ec4899'] },
  { id: 'breeze',  label: 'Breeze',  colors: ['#0ea5e9', '#9333ea'] },
  { id: 'sunrise', label: 'Sunrise', colors: ['#facc15', '#fb923c'] },
  { id: 'vivid',   label: 'Vivid',   colors: ['#14b8a6', '#00bfff'] },
  { id: 'aurora',  label: 'Aurora',  colors: ['#a855f7', '#22d3ee'] },
];

const MOODS = [
  { id: 'upbeat',        label: '🔥 Energético' },
  { id: 'chill',         label: '😎 Chill' },
  { id: 'corporate',     label: '💼 Corporativo' },
  { id: 'inspirational', label: '🚀 Inspiracional' },
  { id: 'tech',          label: '💻 Tech' },
];

// Construye un array de clips autocontenido a partir de URLs de imagen — punto
// único de entrada para los 3 modos de contenido (single/multi-producto/caso de
// éxito), en vez de tres caminos de código distintos. `perTitles`/`perSubs` (si
// vienen) le dan a cada clip su propio texto; si no, todos comparten
// `sharedTitle`/`sharedSub`. `textX/textY` en 0.5/0.5 reproduce el centrado de
// siempre; `transitionIn` 'cut' en el primero (no hay de dónde transicionar).
function buildDefaultClips(urls, perTitles, perSubs, sharedTitle, sharedSub, totalDuration) {
  const list = (urls || []).filter(Boolean);
  if (list.length === 0) return [];
  const each = totalDuration / list.length;
  return list.map((url, i) => ({
    id: `clip-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    imageUrl: url,
    img: null,
    duration: each,
    title: perTitles ? (perTitles[i] || '') : (sharedTitle || 'Sin título'),
    subtitle: perSubs ? (perSubs[i] || '') : (sharedSub || ''),
    textX: 0.5,
    textY: 0.5,
    textScale: 1,
    transitionIn: i === 0 ? 'cut' : 'crossfade',
  }));
}

export default function CanvasReelGenerator() {
  // ── Contenido ──
  const [activeTab, setActiveTab]             = useState('producto');
  const [products, setProducts]               = useState([]);
  const [projects, setProjects]               = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [rentalData, setRentalData]           = useState({});
  const [priceLabel, setPriceLabel]           = useState('');
  const [showPrice, setShowPrice]             = useState(false);

  // ── Clips — fuente de verdad del timeline (reemplaza selectedImages/loadedImages) ──
  const [clips, setClips]                     = useState([]);
  const [selectedClipId, setSelectedClipId]   = useState(null);
  const [currentTime, setCurrentTime]         = useState(0);
  const [isScrubbing, setIsScrubbing]         = useState(false);

  // ── Multi-producto: varios items en un mismo reel, un slide c/u ──
  const [multiMode, setMultiMode]             = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState([]);
  const MULTI_MAX = 4;

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

  // ── Visual (paso 4) ──
  const [bgTheme, setBgTheme]         = useState('neon');
  const [textEffect, setTextEffect]   = useState('slideup');
  const [duration, setDuration]       = useState(30);
  const [customMainText, setCustomMainText] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');

  // ── Grabación (paso 5) ──
  const [isRecording, setIsRecording]     = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [isUploading, setIsUploading]     = useState(false);
  const [videoUrl, setVideoUrl]           = useState(null);
  const [error, setError]                 = useState(null);

  const canvasRef        = useRef(null);
  const previewWrapperRef = useRef(null);
  const textDragRef      = useRef(null);
  const exchangeService  = new ExchangeService();

  const totalDuration = useMemo(() => clips.reduce((a, c) => a + (c.duration || 0), 0), [clips]);
  const selectedClip  = clips.find((c) => c.id === selectedClipId) || null;

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    setProducts([]);
  }, []);

  useEffect(() => {
    if (activeTab !== 'proyecto') return;
    fetch('/api/proyectos')
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d : d?.proyectos || []))
      .catch(() => {});
  }, [activeTab]);

  // Auto-seleccionar primero al cambiar tab (solo en modo single)
  useEffect(() => {
    if (multiMode) return;
    if (activeTab === 'producto' && products.length > 0)
      selectContent({ ...products[0], type: 'producto' }, [products[0].image].filter(Boolean));
    else if (activeTab === 'tecnologia')
      selectContent({ ...TECH_ITEMS[0], type: 'tecnologia' }, [TECH_ITEMS[0].imageUrl]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, products, multiMode]);

  // Al cambiar de tab en modo multi, limpiar la selección (los ids son por tab)
  useEffect(() => {
    if (multiMode) setMultiSelectedIds([]);
  }, [activeTab, multiMode]);

  // Reconstruye selectedContent como un "combo" a partir de los items tildados
  // en modo multi — un slide por item, con su propia imagen + título/subtítulo.
  useEffect(() => {
    if (!multiMode) return;
    const pool = activeTab === 'producto' ? products
      : activeTab === 'tecnologia' ? TECH_ITEMS
      : projects.map((p) => ({ ...p, id: p.domain, name: p.domain }));

    const items = multiSelectedIds
      .map((id) => pool.find((it) => (it.id ?? it.domain) === id))
      .filter(Boolean);

    if (items.length === 0) {
      setSelectedContent(null);
      setClips([]);
      return;
    }

    const images = items.map((it) => it.image || it.imageUrl || it.screenshotUrl).filter(Boolean);
    const titles = items.map((it) => it.name || it.domain || 'Sin título');
    const subtitles = items.map((it) => {
      if (it.priceUSD) return `USD ${it.priceUSD}`;
      if (it.priceARS || it.price) return formatARS(it.priceARS || it.price);
      return it.category || '';
    });

    setSelectedContent({
      type: activeTab,
      multi: true,
      items,
      name: `${items.length} items combinados`,
      titles,
      subtitles,
    });
    setClips(buildDefaultClips(images.slice(0, MULTI_MAX), titles, subtitles, null, null, duration));
    setVideoUrl(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiMode, multiSelectedIds, activeTab, products, projects]);

  function toggleMultiSelect(id) {
    setMultiSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MULTI_MAX ? [...prev, id] : prev
    );
  }

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
    setClips((prev) => prev.map((c) => ({ ...c, title: sharedTitle, subtitle: sharedSub })));
  }, [customMainText, customSubtitle, showPrice, priceLabel, selectedContent]);

  // Mantiene selectedClipId apuntando a un clip real (primero disponible si el
  // anterior ya no existe tras un rebuild) — no pausa el preview por sí solo.
  useEffect(() => {
    if (clips.length === 0) { setSelectedClipId(null); return; }
    if (!clips.some((c) => c.id === selectedClipId)) setSelectedClipId(clips[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  // Carga las imágenes de los clips y les inyecta el <img> ya cargado — keyeado
  // por el SET de URLs (no por `clips` completo) para no relanzar la carga en
  // cada reorder/ajuste de duración/texto, y mergeado por URL para que
  // reordenar o repetir una misma URL (caso de éxito) no rompa nada.
  const imageUrlsKey = useMemo(
    () => [...new Set(clips.map((c) => c.imageUrl).filter(Boolean))].sort().join('|'),
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
      setClips((prev) => prev.map((c) => (map[c.imageUrl] ? { ...c, img: map[c.imageUrl] } : c)));
    });
    return () => { cancelled = true; };
  }, [imageUrlsKey]);

  // Preview canvas — se saltea mientras se está scrubbeando/editando en pausa
  // (ahí el frame se pinta a mano vía drawFrameAt, ver mutateClips/handleScrub).
  useEffect(() => {
    if (!canvasRef.current || !selectedContent || isScrubbing) return;
    canvasReelService.startPreview(canvasRef.current, buildConfig());
    return () => canvasReelService.stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContent, textEffect, duration, clips, bgTheme, showPrice, priceLabel, isScrubbing]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function selectContent(content, images = []) {
    setSelectedContent(content);
    setClips(buildDefaultClips(images.filter(Boolean).slice(0, 4), null, null, content?.name || content?.sitio, '', duration));
    setSelectedClipId(null);
    setIsScrubbing(false);
    setVideoUrl(null);
    setError(null);
    setScript('');
    setTtsBase64('');
  }

  function buildConfig(clipsOverride) {
    const bg = BG_THEMES.find((t) => t.id === bgTheme)?.colors || BG_THEMES[0].colors;
    return {
      clips: clipsOverride || clips,
      textEffect,
      musicUrl,
      ttsBase64:   voiceEnabled ? ttsBase64 : '',
      voiceVolume,
      musicVolume,
      contentType: selectedContent?.type || 'default',
      bgColors:    bg,
    };
  }

  // Punto único de mutación de `clips`: si está pausado editando (isScrubbing),
  // repinta el frame estático de una con el resultado — si no, el efecto de
  // preview de arriba lo toma solo en el próximo render.
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

  // Ripple-trim: cambiar la duración de un clip le resta lo mismo al siguiente,
  // así la duración total del reel no se mueve por accidente al ajustar uno.
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

  // Duración global (15/30s): reescala todos los clips proporcionalmente en vez
  // de ser un campo primario — preserva las proporciones relativas ya ajustadas.
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

  const toggleImage = (url) =>
    mutateClips((prev) => {
      const exists = prev.some((c) => c.imageUrl === url);
      if (exists) return prev.filter((c) => c.imageUrl !== url);
      if (prev.length >= 4) return prev;
      return [...prev, {
        id: `clip-manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        imageUrl: url,
        img: null,
        duration: prev[0]?.duration || duration,
        title: prev[0]?.title || selectedContent?.name || 'Sin título',
        subtitle: prev[0]?.subtitle || '',
        textX: 0.5, textY: 0.5, textScale: 1,
        transitionIn: prev.length === 0 ? 'cut' : 'crossfade',
      }];
    });

  const availableImages = (() => {
    if (!selectedContent) return [];
    return [...new Set([selectedContent.image, selectedContent.imageUrl, selectedContent.screenshotUrl].filter(Boolean))];
  })();

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;

  // ── PASO 2: Generar script ────────────────────────────────────────────────
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
          // Los proyectos guardan la descripción real en `descripcionCorta` (Firestore
          // coleccion "proyectos"), no en shortDescription/description como los productos.
          contentDescription: selectedContent.shortDescription || selectedContent.description || selectedContent.descripcionCorta || '',
          items: selectedContent.multi
            ? selectedContent.items.map((it) => ({ name: it.name || it.domain, description: it.shortDescription || it.description || it.category || '' }))
            : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScript(data.script || '');
      setTtsBase64(''); // reset TTS si se regenera
    } catch (e) {
      setScriptError(e.message);
    } finally {
      setScriptLoading(false);
    }
  }

  // Caso de éxito: arma 4 slides (problema → solución → impacto → CTA) a partir
  // de los datos reales del proyecto (descripcionCorta/funcionalidades/impacto en
  // Firestore) en vez de un slide único genérico. Reusa el mismo constructor de
  // clips que el modo multi-producto, repitiendo la misma captura 4 veces.
  const canCaseStudy = activeTab === 'proyecto' && selectedContent && !selectedContent.multi
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
      const shot = clips[0]?.imageUrl;
      setSelectedContent((prev) => ({
        ...prev,
        multi: true,
        titles: slides.map((s) => s.title || ''),
        subtitles: slides.map((s) => s.subtitle || ''),
      }));
      if (shot && slides.length > 0) {
        setClips(buildDefaultClips(Array(slides.length).fill(shot), slides.map((s) => s.title), slides.map((s) => s.subtitle), null, null, duration));
      }
    } catch (e) {
      setScriptError(e.message);
    } finally {
      setScriptLoading(false);
    }
  }

  // ── PASO 3: Música — catálogo real vía Jamendo (gratis, buscable) ──────────
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

  // ── PASO 3: Voz ───────────────────────────────────────────────────────────
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

  // ── PASO 5: Grabar ────────────────────────────────────────────────────────
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

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">🎬 Generador de Reels (Canvas)</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Columna izquierda: Config ── */}
        <div className="space-y-5">

          {/* ── PASO 1: Contenido ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Paso 1 — Contenido</h3>

            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex gap-2">
                {TABS.map((t) => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      activeTab === t.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >{t.label}</button>
                ))}
              </div>
              <button onClick={() => setMultiMode((v) => !v)}
                title="Combinar varios items en un mismo reel (un slide por item)"
                className={`shrink-0 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                  multiMode ? 'bg-pink-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >🧩 Multi {multiMode ? `(${multiSelectedIds.length}/${MULTI_MAX})` : ''}</button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {activeTab === 'producto' && products.map((p) => (
                <button key={p.id}
                  onClick={() => multiMode ? toggleMultiSelect(p.id) : selectContent({ ...p, type: 'producto' }, [p.image].filter(Boolean))}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    (multiMode ? multiSelectedIds.includes(p.id) : selectedContent?.id === p.id)
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >{multiMode && <span>{multiSelectedIds.includes(p.id) ? '☑' : '☐'}</span>}{p.name}</button>
              ))}
              {activeTab === 'tecnologia' && TECH_ITEMS.map((t) => (
                <button key={t.id}
                  onClick={() => multiMode ? toggleMultiSelect(t.id) : selectContent({ ...t, type: 'tecnologia' }, [t.imageUrl])}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    (multiMode ? multiSelectedIds.includes(t.id) : selectedContent?.id === t.id)
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >{multiMode && <span>{multiSelectedIds.includes(t.id) ? '☑' : '☐'}</span>}{t.name} <span className="text-gray-400">— {t.category}</span></button>
              ))}
              {activeTab === 'proyecto' && projects.length === 0 && (
                <p className="text-xs text-gray-400 p-2">Cargando proyectos…</p>
              )}
              {activeTab === 'proyecto' && projects.map((p, i) => (
                <button key={i}
                  onClick={() => multiMode ? toggleMultiSelect(p.domain) : selectContent(
                    { ...p, id: p.domain, name: p.domain, type: 'proyecto' },
                    [p.screenshotUrl].filter(Boolean)
                  )}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    (multiMode ? multiSelectedIds.includes(p.domain) : selectedContent?.id === p.sitio)
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >{multiMode && <span>{multiSelectedIds.includes(p.domain) ? '☑' : '☐'}</span>}{p.domain}</button>
              ))}
            </div>

            {multiMode && selectedContent?.multi && (
              <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700 rounded-lg p-2 text-xs text-pink-700 dark:text-pink-300">
                🧩 {selectedContent.items.length} items combinados — 1 slide por c/u: {selectedContent.titles.join(' · ')}
              </div>
            )}

            {/* Imágenes */}
            {availableImages.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Imágenes ({clips.length}/4)</p>
                <div className="flex gap-2 flex-wrap">
                  {availableImages.map((url) => (
                    <button key={url} onClick={() => toggleImage(url)}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        clips.some((c) => c.imageUrl === url)
                          ? 'border-purple-500 scale-105'
                          : 'border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      {clips.some((c) => c.imageUrl === url) && (
                        <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info precio */}
            {selectedContent && !selectedContent.multi && (
              <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-300">Producto: </span>
                    <span className="text-white font-semibold">{selectedContent.name || selectedContent.sitio}</span>
                    {priceLabel && <div className="text-green-300 font-semibold mt-0.5">{priceLabel}</div>}
                    {selectedContent.rental && (
                      <div className="text-slate-200 mt-0.5">
                        Alquiler: seña ${selectedContent.rental.seña} · cuota ${selectedContent.rental.cuota}/mes · mín {selectedContent.rental.duracionMinima}m
                      </div>
                    )}
                  </div>
                  {selectedContent.type === 'producto' && priceLabel && (
                    <button
                      onClick={() => setShowPrice((v) => !v)}
                      className={`shrink-0 px-2 py-1 rounded text-xs font-semibold transition-colors ${
                        showPrice
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      💲 {showPrice ? 'Precio: SÍ' : 'Precio: NO'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── PASO 2: Script ── */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Paso 2 — Script</h3>

            <div className="flex gap-2">
              <button onClick={handleGenerateScript} disabled={!selectedContent || scriptLoading}
                className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded text-sm font-semibold disabled:opacity-50 hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                {scriptLoading ? 'Generando…' : '✨ Generar script con Gemini'}
              </button>
              {script && (
                <button onClick={handleGenerateScript} disabled={scriptLoading}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Regenerar"
                >🔄</button>
              )}
            </div>

            {canCaseStudy && (
              <button onClick={handleGenerateCaseStudy} disabled={scriptLoading}
                title="Arma 4 slides (problema → solución → impacto → CTA) con los datos reales del proyecto, y un guion en primera persona"
                className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded text-sm font-semibold disabled:opacity-50 hover:from-amber-700 hover:to-orange-700 transition-all"
              >
                {scriptLoading ? 'Generando…' : '🎯 Armar caso de éxito (problema → solución → impacto)'}
              </button>
            )}

            {scriptError && <p className="text-red-400 text-xs">{scriptError}</p>}

            {selectedContent?.multi && !multiMode && selectedContent?.titles?.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2 space-y-1">
                {selectedContent.titles.map((t, i) => (
                  <p key={i} className="text-xs text-amber-800 dark:text-amber-300">
                    <span className="font-bold">{i + 1}.</span> {t}
                    {selectedContent.subtitles?.[i] && <span className="text-amber-600 dark:text-amber-500"> — {selectedContent.subtitles[i]}</span>}
                  </p>
                ))}
              </div>
            )}

            {script !== undefined && (
              <div className="space-y-1">
                <textarea
                  value={script}
                  onChange={(e) => { setScript(e.target.value); setTtsBase64(''); }}
                  rows={4}
                  placeholder="El script aparecerá aquí — podés editarlo antes de grabar"
                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className={`text-xs text-right ${wordCount > 60 ? 'text-red-400' : 'text-gray-400'}`}>
                  {wordCount}/60 palabras
                </div>
              </div>
            )}
          </section>

          {/* ── PASO 3: Audio ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Paso 3 — Audio</h3>

            {/* Música — catálogo Jamendo (gratis, buscable) */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Estilo (catálogo Jamendo, gratis)</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 mb-2">
                {MOODS.map((m) => (
                  <button key={m.id}
                    onClick={() => handleLoadMusic(m.id)}
                    disabled={musicLoading}
                    className={`py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                      mood === m.id && !musicQuery
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >{m.label}</button>
                ))}
              </div>

              <div className="flex gap-1.5 mb-2">
                <input
                  value={musicQuery}
                  onChange={(e) => setMusicQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()}
                  placeholder="Buscar por nombre o artista…"
                  className="flex-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button onClick={handleSearchMusic} disabled={musicLoading}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >🔍</button>
              </div>

              {musicLoading && musicTracks.length === 0 && <p className="text-xs text-gray-400">Cargando música…</p>}

              {musicTracks.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5">
                  {musicTracks.map((t) => (
                    <div key={t.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                        selectedTrack?.id === t.id
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <button onClick={() => previewTrack(t)} className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">
                        {previewingTrackId === t.id ? '⏸' : '▶'}
                      </button>
                      <button onClick={() => selectTrack(t)} className="flex-1 text-left truncate">
                        <span className="font-medium">{t.nombre}</span>
                        <span className="text-gray-400"> — {t.artista}</span>
                      </button>
                      {selectedTrack?.id === t.id && <span className="shrink-0 text-blue-500">✓</span>}
                    </div>
                  ))}
                  {hasMoreMusic && (
                    <button onClick={() => loadMusicTracks({ append: true })} disabled={musicLoading}
                      className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-1 disabled:opacity-50"
                    >{musicLoading ? 'Cargando…' : 'Cargar más ↓'}</button>
                  )}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">🎵 Volumen</span>
                <input type="range" min="0" max="1" step="0.05" value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-gray-400 w-8 text-right">{Math.round(musicVolume * 100)}%</span>
              </div>
            </div>

            {/* Voz */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-xs text-gray-500">Voz (Google TTS)</p>
                <button onClick={() => setVoiceEnabled((v) => !v)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    voiceEnabled ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >{voiceEnabled ? '🔊 ON' : '🔇 OFF'}</button>
              </div>

              {voiceEnabled && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={handleGenerateTTS} disabled={!script || ttsLoading}
                      className="flex-1 py-1.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded text-xs font-semibold disabled:opacity-50 hover:from-green-700 hover:to-teal-700 transition-all"
                    >
                      {ttsLoading ? 'Generando voz…' : ttsBase64 ? '✅ Voz generada — Regenerar' : '🎙 Generar voz'}
                    </button>
                    {ttsBase64 && (
                      <button onClick={handlePreviewVoice}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >▶ Escuchar</button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20 shrink-0">🎙 Volumen</span>
                    <input type="range" min="0" max="1" step="0.05" value={voiceVolume}
                      onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                      className="flex-1 accent-green-500"
                    />
                    <span className="text-xs text-gray-400 w-8 text-right">{Math.round(voiceVolume * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── PASO 4: Visual ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Paso 4 — Visual</h3>

            {/* Fondo */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Fondo brillante</p>
              <div className="grid grid-cols-5 gap-1.5">
                {BG_THEMES.map((theme) => (
                  <button key={theme.id} onClick={() => setBgTheme(theme.id)}
                    className={`relative h-9 rounded-lg transition-all ${
                      bgTheme === theme.id
                        ? 'ring-4 ring-white ring-offset-2 ring-offset-gray-900 scale-105 shadow-xl'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${theme.colors[0]} 0%, ${theme.colors[1]} 100%)` }}
                  >
                    {bgTheme === theme.id && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow">✓</span>
                    )}
                    <span className="sr-only">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Efecto */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Efecto de texto</p>
              <div className="grid grid-cols-3 gap-1.5">
                {TEXT_EFFECTS.map((e) => (
                  <button key={e.id} onClick={() => setTextEffect(e.id)}
                    className={`py-1.5 rounded text-xs font-medium transition-colors ${
                      textEffect === e.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >{e.label}</button>
                ))}
              </div>
            </div>

            {/* Tamaño del texto — por clip seleccionado */}
            {selectedClip && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">
                  Tamaño del título <span className="text-gray-600">(clip seleccionado)</span>
                </p>
                <div className="flex items-center gap-2">
                  <input type="range" min="0.5" max="2" step="0.05" value={selectedClip.textScale ?? 1}
                    onChange={(e) => updateClip(selectedClip.id, { textScale: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xs text-gray-400 w-10 text-right">{(selectedClip.textScale ?? 1).toFixed(2)}×</span>
                </div>
              </div>
            )}

            {/* Duración */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Duración total</p>
              <div className="flex gap-2">
                {[15, 30].map((d) => (
                  <button key={d} onClick={() => handleSetDuration(d)}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      duration === d
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >{d}s</button>
                ))}
                <span className="text-xs text-gray-500 self-center ml-2">Actual: {totalDuration.toFixed(1)}s</span>
              </div>
            </div>

            {/* Texto custom */}
            <div className="grid grid-cols-2 gap-2">
              <input
                value={customMainText}
                onChange={(e) => setCustomMainText(e.target.value)}
                placeholder="Título (opcional)"
                className="text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <input
                value={customSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                placeholder="Subtitle (opcional)"
                className="text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </section>

          {/* ── PASO 5: Grabar ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Paso 5 — Grabar</h3>

            <button onClick={handleRecord} disabled={!selectedContent || clips.length === 0 || busy}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-all hover:from-purple-700 hover:to-blue-700"
            >{busyLabel}</button>

            {busy && (
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                  animate={{ width: `${Math.round(recordProgress * 100)}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            )}

            {error && (
              <p className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2">
                ❌ {error}
              </p>
            )}

            {videoUrl && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 space-y-1">
                <p className="text-green-700 dark:text-green-300 font-semibold text-sm">
                  ✅ Video listo — Make.com notificado
                </p>
                <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 text-xs break-all hover:underline"
                >{videoUrl}</a>
              </div>
            )}
          </section>
        </div>

        {/* ── Columna derecha: Preview + Timeline ── */}
        <div className="flex flex-col items-center gap-3 lg:sticky lg:top-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preview 9:16</p>

          <div ref={previewWrapperRef} className="relative" style={{ width: 270, height: 480 }}>
            <canvas
              ref={canvasRef}
              width={270}
              height={480}
              className="rounded-xl shadow-xl border border-gray-300 dark:border-gray-600 bg-black"
            />
            {/* Overlay de texto arrastrable — solo visible/activo con el preview
                pausado en un clip (isScrubbing), para no pelear contra el loop */}
            {isScrubbing && selectedClip && (
              <div
                onPointerDown={handleTextPointerDown}
                onPointerMove={handleTextPointerMove}
                onPointerUp={handleTextPointerUp}
                title="Arrastrá para mover el título"
                className="absolute w-24 h-10 border-2 border-dashed border-purple-400 bg-purple-500/10 rounded cursor-move flex items-center justify-center"
                style={{
                  left: `${(selectedClip.textX ?? 0.5) * 100}%`,
                  top: `${(selectedClip.textY ?? 0.5) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  touchAction: 'none',
                }}
              >
                <span className="text-[9px] text-purple-200 font-semibold pointer-events-none">Título</span>
              </div>
            )}
          </div>

          {isScrubbing && (
            <button onClick={handleResumePreview}
              className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full transition-colors"
            >▶ Reanudar preview</button>
          )}

          {clips.length > 0 && (
            <div className="w-full max-w-xs space-y-2">
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

              {selectedClip && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 shrink-0">Transición de entrada</span>
                  <select
                    value={selectedClip.transitionIn || 'cut'}
                    onChange={(e) => updateClip(selectedClip.id, { transitionIn: e.target.value })}
                    className="flex-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1"
                  >
                    {CLIP_TRANSITIONS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center max-w-xs">
            El preview corre en tiempo real. La grabación renderiza a 1080×1920.
          </p>
        </div>
      </div>
    </div>
  );
}
