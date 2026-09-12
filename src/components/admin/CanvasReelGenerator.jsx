'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { canvasReelService, TEXT_EFFECTS } from '../../utils/canvasReelService';
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

export default function CanvasReelGenerator() {
  // ── Contenido ──
  const [activeTab, setActiveTab]             = useState('producto');
  const [products, setProducts]               = useState([]);
  const [projects, setProjects]               = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedImages, setSelectedImages]   = useState([]);
  const [loadedImages, setLoadedImages]       = useState([]);
  const [rentalData, setRentalData]           = useState({});
  const [priceLabel, setPriceLabel]           = useState('');
  const [showPrice, setShowPrice]             = useState(false);

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

  const canvasRef      = useRef(null);
  const exchangeService = new ExchangeService();

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
      setSelectedImages([]);
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
    setSelectedImages(images.slice(0, MULTI_MAX));
    setVideoUrl(null);
    setError(null);
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

  // Preview canvas
  useEffect(() => {
    if (!canvasRef.current || !selectedContent) return;
    canvasReelService.startPreview(canvasRef.current, buildConfig(), loadedImages);
    return () => canvasReelService.stopPreview();
  }, [selectedContent, textEffect, duration, loadedImages, bgTheme, showPrice, priceLabel]);

  useEffect(() => {
    canvasReelService.loadImages(selectedImages).then(setLoadedImages);
  }, [selectedImages]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function selectContent(content, images = []) {
    setSelectedContent(content);
    setSelectedImages(images.filter(Boolean).slice(0, 4));
    setVideoUrl(null);
    setError(null);
    setScript('');
    setTtsBase64('');
  }

  function buildConfig() {
    const isProducto = selectedContent?.type === 'producto';
    const rental = selectedContent?.rental;
    const storeText = isProducto
      ? (showPrice && priceLabel
          ? priceLabel
          : (rental ? 'Precio · Compra o alquiler en la tienda' : 'Precio y formas de pago en la tienda'))
      : '';
    const textLines = [customSubtitle || storeText].filter(Boolean);
    const bg = BG_THEMES.find((t) => t.id === bgTheme)?.colors || BG_THEMES[0].colors;
    return {
      title:       customMainText || selectedContent?.name || selectedContent?.sitio || 'Sin título',
      subtitle:    textLines.join(' · '),
      // Modo multi-producto: un título/subtítulo por imagen, se reanima al cambiar de slide
      titles:      selectedContent?.multi ? selectedContent.titles : undefined,
      subtitles:   selectedContent?.multi ? selectedContent.subtitles : undefined,
      textEffect,
      duration,
      musicUrl,
      ttsBase64:   voiceEnabled ? ttsBase64 : '',
      voiceVolume,
      musicVolume,
      contentType: selectedContent?.type || 'default',
      bgColors:    bg,
      thumbnailIndex: 0,
    };
  }

  const toggleImage = (url) =>
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : prev.length < 4 ? [...prev, url] : prev
    );

  const availableImages = (() => {
    if (!selectedContent) return [];
    return [...new Set([selectedContent.image, selectedContent.imageUrl, selectedContent.screenshot].filter(Boolean))];
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
          contentDescription: selectedContent.shortDescription || selectedContent.description || '',
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
    if (!selectedContent || isRecording || isUploading) return;
    setError(null);
    setVideoUrl(null);
    setIsRecording(true);
    setRecordProgress(0);
    canvasReelService.stopPreview();

    try {
      const blob = await canvasReelService.record(buildConfig(), loadedImages, setRecordProgress);
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
          subtitle:   cfg.subtitle,
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
      if (canvasRef.current && selectedContent)
        canvasReelService.startPreview(canvasRef.current, buildConfig(), loadedImages);
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
                <p className="text-xs text-gray-500 mb-1">Imágenes ({selectedImages.length}/4)</p>
                <div className="flex gap-2 flex-wrap">
                  {availableImages.map((url) => (
                    <button key={url} onClick={() => toggleImage(url)}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImages.includes(url)
                          ? 'border-purple-500 scale-105'
                          : 'border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      {selectedImages.includes(url) && (
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

            {scriptError && <p className="text-red-400 text-xs">{scriptError}</p>}

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

            {/* Duración */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Duración</p>
              <div className="flex gap-2">
                {[15, 30].map((d) => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      duration === d
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >{d}s</button>
                ))}
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

            <button onClick={handleRecord} disabled={!selectedContent || busy}
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

        {/* ── Columna derecha: Preview ── */}
        <div className="flex flex-col items-center gap-3 lg:sticky lg:top-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Preview 9:16</p>
          <canvas
            ref={canvasRef}
            width={270}
            height={480}
            className="rounded-xl shadow-xl border border-gray-300 dark:border-gray-600 bg-black"
          />
          <p className="text-xs text-gray-400 text-center max-w-xs">
            El preview corre en tiempo real. La grabación renderiza a 1080×1920.
          </p>
        </div>
      </div>
    </div>
  );
}
