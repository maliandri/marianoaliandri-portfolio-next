'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { canvasReelService, MUSIC_TRACKS, TEXT_EFFECTS } from '../../utils/canvasReelService';
import { SERVICE_LOGOS } from '../../data/serviceLogos';
import priceService from '../../utils/priceService';
import { ExchangeService, formatARS, formatUSD } from '../../utils/exchangeService';

const TECH_ITEMS = [
  { id: 'mercadopago', name: 'MercadoPago Pagos',      category: 'Pagos',          imageUrl: SERVICE_LOGOS.mercadopago },
  { id: 'cloudinary',  name: 'Cloudinary Storage',     category: 'Storage',        imageUrl: SERVICE_LOGOS.cloudinary },
  { id: 'googlegemini',name: 'Google Gemini IA',        category: 'IA',             imageUrl: SERVICE_LOGOS.googlegemini },
  { id: 'firebase',    name: 'Firebase Database',      category: 'Base de Datos',  imageUrl: SERVICE_LOGOS.firebase },
  { id: 'mongodb',     name: 'MongoDB',                category: 'Base de Datos',  imageUrl: SERVICE_LOGOS.mongodb },
  { id: 'resend',      name: 'Resend Email',           category: 'Email',          imageUrl: SERVICE_LOGOS.resend },
  { id: 'vercel',      name: 'Vercel Hosting',         category: 'Hosting',        imageUrl: SERVICE_LOGOS.vercel },
  { id: 'make',        name: 'Make Automatización',    category: 'Automatización', imageUrl: SERVICE_LOGOS.make },
  { id: 'nextdotjs',   name: 'Next.js Framework',      category: 'Hosting',        imageUrl: SERVICE_LOGOS.nextdotjs },
  { id: 'react',       name: 'React Frontend',         category: 'IA',             imageUrl: SERVICE_LOGOS.react },
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

export default function CanvasReelGenerator() {
  const [activeTab, setActiveTab]           = useState('producto');
  const [products, setProducts]             = useState([]);
  const [projects, setProjects]             = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loadedImages, setLoadedImages]     = useState([]);
  const [bgTheme, setBgTheme]               = useState('neon');
  const [textEffect, setTextEffect]         = useState('typewriter');
  const [selectedMusic, setSelectedMusic]   = useState(MUSIC_TRACKS[0]);
  const [duration, setDuration]             = useState(15);
  const [rentalData, setRentalData]         = useState({});
  const [customMainText, setCustomMainText] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [priceLabel, setPriceLabel] = useState('');

  const exchangeService = new ExchangeService();
  const [voiceEnabled, setVoiceEnabled]     = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [isUploading, setIsUploading]       = useState(false);
  const [videoUrl, setVideoUrl]             = useState(null);
  const [error, setError]                   = useState(null);

  const canvasRef = useRef(null);

  // Cargar productos
  useEffect(() => {
    priceService.getAllPrices().then((all) => {
      setProducts(Object.values(all).filter((p) => p.priceUSD));
    });
  }, []);

  // Cargar proyectos al cambiar a ese tab
  useEffect(() => {
    if (activeTab !== 'proyecto') return;
    fetch('/api/proyectos')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : data?.proyectos || []))
      .catch(() => {});
  }, [activeTab]);

  // Cargar datos de productos_alquiler de Firestore
  useEffect(() => {
    fetch('/api/rental-data')
      .then((r) => r.json())
      .then((data) => setRentalData(data || {}))
      .catch(() => setRentalData({}));
  }, []);

  // Auto-seleccionar primero al cambiar tab
  useEffect(() => {
    if (activeTab === 'producto' && products.length > 0) {
      selectContent({ ...products[0], type: 'producto' }, [products[0].image].filter(Boolean));
    } else if (activeTab === 'tecnologia') {
      selectContent({ ...TECH_ITEMS[0], type: 'tecnologia' }, [TECH_ITEMS[0].imageUrl]);
    }
    // proyecto: se selecciona al hacer click
  }, [activeTab, products]);

  // Enriquecer contenido seleccionado con información de alquiler (si existe)
  useEffect(() => {
    if (!selectedContent || selectedContent.type !== 'producto') return;

    const renta = rentalData[selectedContent.id] || rentalData[selectedContent.productoId];
    if (renta && (!selectedContent.rental || selectedContent.rental.seña !== renta.seña)) {
      setSelectedContent((prev) => ({ ...prev, rental: renta }));
    }
  }, [rentalData, selectedContent]);

  // Generar precio en ARS preferido para mostrar como "Desde $..."
  useEffect(() => {
    if (!selectedContent) {
      setPriceLabel('');
      return;
    }

    if (selectedContent.priceUSD) {
      exchangeService.convertUsdToArs(selectedContent.priceUSD).then((ars) => {
        setPriceLabel(`Desde ${formatARS(ars)} (USD ${selectedContent.priceUSD})`);
      }).catch(() => {
        setPriceLabel(`Desde ${formatUSD(selectedContent.priceUSD)}`);
      });
      return;
    }

    if (selectedContent.priceARS) {
      setPriceLabel(`Desde ${formatARS(selectedContent.priceARS)}`);
      return;
    }

    if (selectedContent.price && typeof selectedContent.price === 'number') {
      setPriceLabel(`Desde ${formatARS(selectedContent.price)}`);
      return;
    }

    setPriceLabel('Precio a consultar');
  }, [selectedContent]);

  function selectContent(content, images = []) {
    setSelectedContent(content);
    setSelectedImages(images.filter(Boolean).slice(0, 4));
    setVideoUrl(null);
    setError(null);
  }

  // Cargar imágenes cuando cambia la selección
  useEffect(() => {
    canvasReelService.loadImages(selectedImages).then(setLoadedImages);
  }, [selectedImages]);

  // Actualizar preview cuando cambia config
  useEffect(() => {
    if (!canvasRef.current || !selectedContent) return;
    canvasReelService.startPreview(canvasRef.current, buildConfig(), loadedImages);
    return () => canvasReelService.stopPreview();
  }, [selectedContent, textEffect, duration, loadedImages, bgTheme]);

  function buildConfig() {
    const priceText = priceLabel || (
      selectedContent?.priceUSD
        ? `Desde USD ${selectedContent.priceUSD}`
        : selectedContent?.priceARS
          ? `Desde ARS ${selectedContent.priceARS}`
          : selectedContent?.price
            ? `Desde ${selectedContent.price}`
            : ''
    );

    const rental = selectedContent?.rental;
    const rentalText = rental
      ? `Seña $${rental.seña} · Cuota $${rental.cuota}/mes · ${rental.duracionMinima}m mín`
      : '';

    const textLines = [customSubtitle || priceText, rentalText].filter(Boolean);

    const bg = BG_THEMES.find((t) => t.id === bgTheme)?.colors || BG_THEMES[0].colors;

    return {
      title:       customMainText || selectedContent?.name || selectedContent?.sitio || 'Sin título',
      subtitle:    textLines.join(' · '),
      textEffect,
      duration,
      musicUrl:    selectedMusic.url,
      contentType: selectedContent?.type || 'default',
      bgColors:    bg,
      thumbnailIndex: 0,
    };
  }

  const toggleImage = (url) => {
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : prev.length < 4 ? [...prev, url] : prev
    );
  };

  // Imágenes disponibles del contenido seleccionado
  const availableImages = (() => {
    if (!selectedContent) return [];
    const candidates = [
      selectedContent.image,
      selectedContent.imageUrl,
      selectedContent.screenshot,
    ].filter(Boolean);
    return [...new Set(candidates)];
  })();

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

      // Subir directo al browser → Cloudinary (evita límite 4.5MB de Vercel)
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
      const cloudForm = new FormData();
      cloudForm.append('file', blob, 'reel.webm');
      cloudForm.append('upload_preset', 'portfolio_reels');
      cloudForm.append('folder', 'reels');

      const cloudRes  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
        method: 'POST',
        body: cloudForm,
      });
      if (!cloudRes.ok) {
        const err = await cloudRes.text();
        throw new Error(`Cloudinary error ${cloudRes.status}: ${err}`);
      }
      const { secure_url: uploadedUrl } = await cloudRes.json();

      // Notificar Make.com via API route (solo JSON, sin el blob)
      const productId = selectedContent.id || selectedContent.sitio || 'reel';
      const res  = await fetch('/api/upload-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: uploadedUrl, productId }),
      });
      const data = await res.json();
      if (!data.videoUrl) throw new Error(data.error || 'Error notificando Make.com');

      setVideoUrl(data.videoUrl);

      if (voiceEnabled && 'speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(
          `Reel de ${selectedContent.name || selectedContent.sitio} listo para publicar`
        );
        utt.lang = 'es-AR';
        speechSynthesis.speak(utt);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsRecording(false);
      setIsUploading(false);
      if (canvasRef.current && selectedContent) {
        canvasReelService.startPreview(canvasRef.current, buildConfig(), loadedImages);
      }
    }
  };

  const busy = isRecording || isUploading;
  const busyLabel = isRecording
    ? `Grabando… ${Math.round(recordProgress * 100)}%`
    : isUploading ? 'Subiendo a Cloudinary…' : '⏺ Grabar y publicar';

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">🎬 Generador de Reels (Canvas)</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Columna izquierda: Config ── */}
        <div className="space-y-5">

          {/* Tabs de fuente */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Fuente de contenido</p>
            <div className="flex gap-2 mb-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === t.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {activeTab === 'producto' && products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectContent({ ...p, type: 'producto' }, [p.image].filter(Boolean))}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedContent?.id === p.id
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {p.name}{p.priceUSD ? ` — USD ${p.priceUSD}` : ''}
                </button>
              ))}

              {activeTab === 'tecnologia' && TECH_ITEMS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectContent({ ...t, type: 'tecnologia' }, [t.imageUrl])}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedContent?.id === t.id
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {t.name} <span className="text-gray-400">— {t.category}</span>
                </button>
              ))}

              {activeTab === 'proyecto' && projects.length === 0 && (
                <p className="text-xs text-gray-400 p-2">Cargando proyectos…</p>
              )}
              {activeTab === 'proyecto' && projects.map((p, i) => (
                <button
                  key={i}
                  onClick={() => selectContent(
                    { ...p, id: p.sitio, name: p.sitio, type: 'proyecto' },
                    [p.screenshot].filter(Boolean)
                  )}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedContent?.id === p.sitio
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {p.sitio} {p.clicks ? <span className="text-gray-400">— {p.clicks} clicks</span> : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de imágenes */}
          {availableImages.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Imágenes ({selectedImages.length}/4)
              </p>
              <div className="flex gap-2 flex-wrap">
                {availableImages.map((url) => (
                  <button
                    key={url}
                    onClick={() => toggleImage(url)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImages.includes(url)
                        ? 'border-purple-500 scale-105'
                        : 'border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                    {selectedImages.includes(url) && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Datos visibles para reel (precio componentes + alquiler) */}
          {selectedContent && (
            <div className="bg-slate-900 bg-opacity-40 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-300 mb-1">
                Producto: <span className="text-white font-semibold">{selectedContent.name || selectedContent.sitio}</span>
              </p>
              <p className="text-sm text-green-300 font-semibold mb-1">{priceLabel || 'Precio a consultar'}</p>
              {selectedContent.rental && (
                <p className="text-xs text-slate-200">
                  Alquiler: seña ARS {selectedContent.rental.seña} · cuota ARS {selectedContent.rental.cuota} · mínimo {selectedContent.rental.duracionMinima} meses
                </p>
              )}
            </div>
          )}

          {/* Fondo brillante (tema) */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Fondo brillante</p>
            <div className="grid grid-cols-3 gap-2">
              {BG_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setBgTheme(theme.id)}
                  className={`relative h-10 rounded-lg transition-all ${
                    bgTheme === theme.id
                      ? 'ring-4 ring-white ring-offset-2 ring-offset-gray-900 scale-105 shadow-xl'
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${theme.colors[0]} 0%, ${theme.colors[1]} 100%)`,
                  }}
                >
                  {bgTheme === theme.id && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-base font-bold drop-shadow">✓</span>
                  )}
                  <span className="sr-only">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Efecto de texto */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Efecto de texto</p>
            <div className="grid grid-cols-3 gap-2">
              {TEXT_EFFECTS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setTextEffect(e.id)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    textEffect === e.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Música */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Música</p>
            <div className="flex gap-2 flex-wrap">
              {MUSIC_TRACKS.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setSelectedMusic(t)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedMusic.name === t.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Duración + Voz */}
          <div className="flex gap-6 items-end">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Duración</p>
              <div className="flex gap-2">
                {[15, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      duration === d
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Voz</p>
              <button
                onClick={() => setVoiceEnabled((v) => !v)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  voiceEnabled ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {voiceEnabled ? '🔊 ON' : '🔇 OFF'}
              </button>
            </div>
          </div>

          {/* Botón grabar */}
          <button
            onClick={handleRecord}
            disabled={!selectedContent || busy}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 transition-all hover:from-purple-700 hover:to-blue-700"
          >
            {busyLabel}
          </button>

          {/* Barra de progreso */}
          {busy && (
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                animate={{ width: `${Math.round(recordProgress * 100)}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2">
              ❌ {error}
            </p>
          )}

          {/* Éxito */}
          {videoUrl && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 space-y-1">
              <p className="text-green-700 dark:text-green-300 font-semibold text-sm">
                ✅ Video listo — Make.com notificado
              </p>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-xs break-all hover:underline"
              >
                {videoUrl}
              </a>
            </div>
          )}
        </div>

        {/* ── Columna derecha: Preview ── */}
        <div className="flex flex-col items-center gap-3">
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
