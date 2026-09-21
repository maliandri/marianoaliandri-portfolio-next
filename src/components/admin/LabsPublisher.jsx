'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function microlinkUrl(pageUrl) {
  const clean = pageUrl.replace(/\/$/, '');
  const target = `${clean}?screenshot=1`;
  return `https://api.microlink.io/?url=${encodeURIComponent(target)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=600&viewport.height=800&force=true`;
}

// ─── Catálogo de herramientas Labs ────────────────────────────────────────────
const LABS_TOOLS = [
  {
    id: 'navaja-suiza',
    name: 'Navaja Suiza by Maliandri',
    version: '1.0.0',
    emoji: '🔪',
    platform: 'Windows',
    format: 'Portable .exe',
    price: 'Gratis',
    description:
      'Herramienta de escritorio para analizar y gestionar el almacenamiento de un celular Android desde la PC. Conectás por USB, ves qué ocupa espacio, hacés backups y eliminás archivos sin tocar el teléfono.',
    features: [
      'Detecta Android automáticamente por USB',
      'Mapa de almacenamiento ordenado por tamaño con drill-down',
      'Vista por Año → Mes → Semana',
      'Backup selectivo de carpetas o años enteros',
      'Eliminación segura con confirmación obligatoria',
      'Multi-idioma: Español e Inglés en tiempo real',
      'Tema oscuro Catppuccin Mocha',
      'Portable — no requiere instalación',
    ],
    requirements: [
      'Windows 10 / 11',
      'Depuración USB activada en el celular',
      'Cable USB con soporte de datos',
    ],
    downloadUrl: 'https://marianoaliandri.com.ar/labs',
    pageUrl:     'https://marianoaliandri.com.ar/labs',
    cloudinaryId: 'labs/navaja-suiza-screenshot',
    tags: ['Android', 'almacenamiento', 'backup', 'ADB', 'Python', 'desktop', 'gratis'],
  },
];

const POST_TYPES = [
  { id: 'launch',   label: 'Lanzamiento',       desc: 'Anuncio oficial de la herramienta' },
  { id: 'features', label: 'Características',    desc: 'Destacar funcionalidades clave' },
  { id: 'howto',    label: 'Cómo usarla',        desc: 'Guía rápida de uso paso a paso' },
  { id: 'whyuse',   label: 'Por qué usarla',     desc: 'Problema que resuelve + beneficios' },
  { id: 'update',   label: 'Update / Novedad',   desc: 'Nueva versión o mejora reciente' },
];

const REDES = [
  { id: 'LinkedIn',  label: 'LinkedIn',  icon: '💼', color: '#0A66C2' },
  { id: 'Instagram', label: 'Instagram', icon: '📷', color: '#E1306C' },
  { id: 'Facebook',  label: 'Facebook',  icon: '👥', color: '#1877F2' },
  { id: 'Todas',     label: 'Todas',     icon: '🌐', color: '#7c3aed' },
];

const TONOS = [
  { id: 'profesional', label: 'Profesional' },
  { id: 'casual',      label: 'Casual' },
  { id: 'técnico',     label: 'Técnico' },
];

const STATUS = { idle: 'idle', sending: 'sending', success: 'success', error: 'error' };

export default function LabsPublisher() {
  const [selectedTool,    setSelectedTool]    = useState(LABS_TOOLS[0].id);
  const [selectedPost,    setSelectedPost]    = useState('launch');
  const [selectedRed,     setSelectedRed]     = useState('LinkedIn');
  const [selectedTono,    setSelectedTono]    = useState('profesional');
  const [extraContext,    setExtraContext]     = useState('');
  const [imageUrl,        setImageUrl]        = useState('');
  const [capturing,       setCapturing]       = useState(false);
  const [captureMsg,      setCaptureMsg]      = useState('');
  const [uploading,       setUploading]       = useState(false);
  const [status,          setStatus]          = useState(STATUS.idle);
  const [errorMsg,        setErrorMsg]        = useState('');

  const tool     = LABS_TOOLS.find(t => t.id === selectedTool);
  const postType = POST_TYPES.find(p => p.id === selectedPost);
  const red      = REDES.find(r => r.id === selectedRed);
  const canSend  = tool && postType && status === STATUS.idle;

  // Al cambiar herramienta, pre-cargar preview Microlink
  useEffect(() => {
    if (tool) {
      setImageUrl(microlinkUrl(tool.pageUrl));
      setCaptureMsg('');
    }
  }, [selectedTool]);

  const handleCapture = async () => {
    if (!tool) return;
    setCapturing(true);
    setCaptureMsg('');
    try {
      const screenshotSrc = microlinkUrl(tool.pageUrl);
      const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const PRESET        = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      const form = new FormData();
      form.append('file',          screenshotSrc);
      form.append('upload_preset', PRESET);

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body:   form,
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      setImageUrl(data.secure_url);
      setCaptureMsg('✅ Subido a Cloudinary');
    } catch (err) {
      setCaptureMsg(`❌ ${err.message}`);
    } finally {
      setCapturing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setCaptureMsg('');
    try {
      const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const PRESET     = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      const form = new FormData();
      form.append('file',          file);
      form.append('upload_preset', PRESET);

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body:   form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      setImageUrl(data.secure_url);
      setCaptureMsg('✅ Imagen subida desde PC');
    } catch (err) {
      setCaptureMsg(`❌ ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Arma el texto completo que Gemini de Make.com va a usar para generar el post
  const buildText = () => {
    const featuresText = tool.features.map(f => `• ${f}`).join('\n');
    const tagsText = tool.tags.map(t => `#${t}`).join(' ');

    return `🧪 LABS — ${postType.label.toUpperCase()} | Tono: ${selectedTono}

HERRAMIENTA: ${tool.name}
VERSIÓN: ${tool.version} | PLATAFORMA: ${tool.platform} | FORMATO: ${tool.format} | PRECIO: ${tool.price}

DESCRIPCIÓN:
${tool.description}

CARACTERÍSTICAS PRINCIPALES:
${featuresText}

LINK DE DESCARGA: ${tool.downloadUrl}

HASHTAGS SUGERIDOS: ${tagsText} #labs #maliandri #herramientas #desktop
${extraContext ? `\nCONTEXTO ADICIONAL DEL AUTOR:\n${extraContext}` : ''}`.trim();
  };

  const handleSend = async () => {
    if (!canSend) return;
    setStatus(STATUS.sending);
    setErrorMsg('');

    const richText = buildText();

    try {
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Mismo formato que "publicación libre" — Gemini de Make.com genera el post
          text:       richText,
          content:    richText,
          caption:    richText,
          description: richText,
          networks: selectedRed === 'Todas'
            ? ['linkedin', 'instagram', 'facebook']
            : [selectedRed.toLowerCase()],
          type:       'service',
          useAI:      true,
          aiProvider: 'gemini',
          imageUrl:   imageUrl || '',
          url:        imageUrl || '',
          metadata: {
            tone:     selectedTono,
            topic:    `${tool.name} — ${postType.label}`,
            serviceUrl: tool.downloadUrl,
          },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setStatus(STATUS.success);
      setTimeout(() => setStatus(STATUS.idle), 4000);
    } catch (e) {
      setErrorMsg(e.message || 'Error al conectar con Make.com');
      setStatus(STATUS.error);
      setTimeout(() => setStatus(STATUS.idle), 5000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 max-w-3xl"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          Publicar Labs
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Elegí la herramienta y el tipo de post — Gemini redacta y Make.com publica
        </p>
      </div>

      {/* 1. Herramienta */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="bg-indigo-600 text-white text-[11px] rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
          Herramienta
        </h3>
        <div className="space-y-2">
          {LABS_TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTool(t.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-4 ${
                selectedTool === t.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center text-2xl flex-shrink-0">
                {t.emoji}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${selectedTool === t.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                  {t.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400">v{t.version}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">{t.platform}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{t.price}</span>
                </div>
              </div>
              {selectedTool === t.id && (
                <span className="text-indigo-600 dark:text-indigo-400 text-lg flex-shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Tipo de post */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="bg-indigo-600 text-white text-[11px] rounded-full w-5 h-5 flex items-center justify-center font-bold">2</span>
          Tipo de post
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {POST_TYPES.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPost(p.id)}
              className={`text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                selectedPost === p.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <p className="font-semibold">{p.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Red Social */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="bg-indigo-600 text-white text-[11px] rounded-full w-5 h-5 flex items-center justify-center font-bold">3</span>
          Red Social
        </h3>
        <div className="flex gap-2 flex-wrap">
          {REDES.map(r => (
            <motion.button
              key={r.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedRed(r.id)}
              style={selectedRed === r.id ? { backgroundColor: r.color, borderColor: r.color } : {}}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedRed === r.id
                  ? 'text-white shadow-lg'
                  : 'border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              {r.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 4. Tono */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="bg-indigo-600 text-white text-[11px] rounded-full w-5 h-5 flex items-center justify-center font-bold">4</span>
          Tono
        </h3>
        <div className="flex gap-2 flex-wrap">
          {TONOS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTono(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTono === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Imagen */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="bg-indigo-600 text-white text-[11px] rounded-full w-5 h-5 flex items-center justify-center font-bold">5</span>
          Imagen del post
        </h3>

        {/* Preview */}
        <AnimatePresence mode="wait">
          {imageUrl && (
            <motion.div
              key={imageUrl.slice(-30)}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mb-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800"
            >
              <img
                src={imageUrl}
                alt="preview"
                className="w-full max-h-56 object-cover object-top"
                onError={e => { e.target.style.display = 'none'; }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Acciones de imagen */}
        <div className="flex gap-2 mb-3">
          {/* Capturar screenshot */}
          <motion.button
            onClick={handleCapture}
            disabled={capturing || uploading}
            whileHover={capturing || uploading ? {} : { scale: 1.02 }}
            whileTap={capturing || uploading ? {} : { scale: 0.98 }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
          >
            {capturing ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block">◌</motion.span>
                Capturando...
              </>
            ) : (
              <>Screenshot de /labs</>
            )}
          </motion.button>

          {/* Subir desde PC */}
          <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all
            ${uploading
              ? 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
              : 'border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            {uploading ? (
              <>
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block">◌</motion.span>
                Subiendo...
              </>
            ) : (
              <>Subir desde PC</>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading || capturing}
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {captureMsg && (
          <p className={`text-xs mb-3 ${captureMsg.startsWith('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {captureMsg}
          </p>
        )}

        {/* URL manual override */}
        <input
          type="text"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="URL de imagen (se actualiza al capturar)"
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
        />
        {imageUrl && (
          <button
            onClick={() => { setImageUrl(''); setCaptureMsg(''); }}
            className="mt-2 text-xs text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Quitar imagen
          </button>
        )}
      </div>

      {/* 6. Contexto extra */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
          <span className="bg-indigo-600 text-white text-[11px] rounded-full w-5 h-5 flex items-center justify-center font-bold">6</span>
          Contexto extra
          <span className="text-[11px] text-gray-500 font-normal normal-case tracking-normal">— opcional</span>
        </h3>
        <textarea
          value={extraContext}
          onChange={e => setExtraContext(e.target.value)}
          placeholder="Ej: Mencioná que es la primera app del Lab, que salió esta semana, que hay video demo..."
          rows={3}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
        />
      </div>

      {/* Resumen */}
      {tool && postType && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200 dark:border-neutral-800 text-sm text-gray-700 dark:text-gray-300 space-y-1"
        >
          <p><span className="text-gray-500">Herramienta:</span> {tool.name} v{tool.version}</p>
          <p><span className="text-gray-500">Post:</span> {postType.label}</p>
          <p><span className="text-gray-500">Red:</span> <span style={{ color: red?.color }}>{red?.label}</span></p>
          <p><span className="text-gray-500">Tono:</span> <span className="capitalize">{selectedTono}</span></p>
          <p><span className="text-gray-500">Imagen:</span> {imageUrl ? <span className="text-green-600 dark:text-green-400">URL cargada</span> : <span className="text-gray-500">Sin imagen</span>}</p>
        </motion.div>
      )}

      {/* Botón Enviar */}
      <motion.button
        whileHover={canSend ? { scale: 1.02 } : {}}
        whileTap={canSend ? { scale: 0.98 } : {}}
        onClick={handleSend}
        disabled={!canSend}
        className="w-full py-3.5 rounded-lg font-semibold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: canSend
            ? '#4f46e5'
            : '#374151',
        }}
      >
        <AnimatePresence mode="wait">
          {status === STATUS.sending && (
            <motion.span key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="inline-block">◌</motion.span>
              Enviando a Make.com...
            </motion.span>
          )}
          {status === STATUS.success && (
            <motion.span key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 text-green-300">
              Enviado — Gemini está generando el post
            </motion.span>
          )}
          {status === STATUS.error && (
            <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 text-red-300">
              {errorMsg || 'Error al enviar'}
            </motion.span>
          )}
          {status === STATUS.idle && (
            <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2">
              Enviar a Make.com
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}
