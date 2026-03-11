'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SERVICE_LOGOS } from '@/data/serviceLogos';

// Mapa tema → clave de logo
const TEMA_LOGO = {
  'Integración de MercadoPago Checkout':             'mercadopago',
  'Suscripciones y pagos recurrentes con MercadoPago': 'mercadopago',
  'Bindx para pagos recurrentes':                    'mercadopago',
  'Gestión de imágenes y video con Cloudinary':      'cloudinary',
  'CDN y optimización de medios':                    'cloudinary',
  'Chatbots inteligentes con Gemini AI':             'googlegemini',
  'Automatización con IA para negocios':             'googlegemini',
  'Generación de contenido con IA':                  'googlegemini',
  'Firebase Firestore para apps en tiempo real':     'firebase',
  'MongoDB Atlas para proyectos escalables':         'mongodb',
  'Supabase como alternativa open source':           'supabase',
  'Email transaccional con Resend':                  'resend',
  'Notificaciones automáticas por email':            'resend',
  'Deploy en Vercel para proyectos Next.js':         'vercel',
  'Netlify con Serverless Functions':                'netlify',
  'Deploy full-stack sin servidor propio':           'vercel',
  'Flujos automáticos con Make.com':                 'make',
  'Webhooks e integraciones entre servicios':        'make',
  'Generación y edición de video con Shotstack':     'framermotion',
  'Thumbnails dinámicos con Microlink API':          'nextdotjs',
};

const CATEGORIAS = [
  {
    id: 'pagos',
    label: '💳 Pagos',
    temas: [
      'Integración de MercadoPago Checkout',
      'Suscripciones y pagos recurrentes con MercadoPago',
      'Bindx para pagos recurrentes',
    ],
  },
  {
    id: 'storage',
    label: '🗄️ Storage',
    temas: [
      'Gestión de imágenes y video con Cloudinary',
      'CDN y optimización de medios',
    ],
  },
  {
    id: 'ia',
    label: '🤖 IA',
    temas: [
      'Chatbots inteligentes con Gemini AI',
      'Automatización con IA para negocios',
      'Generación de contenido con IA',
    ],
  },
  {
    id: 'database',
    label: '🗃️ Base de Datos',
    temas: [
      'Firebase Firestore para apps en tiempo real',
      'MongoDB Atlas para proyectos escalables',
      'Supabase como alternativa open source',
    ],
  },
  {
    id: 'email',
    label: '📧 Email',
    temas: [
      'Email transaccional con Resend',
      'Notificaciones automáticas por email',
    ],
  },
  {
    id: 'hosting',
    label: '🚀 Hosting & Deploy',
    temas: [
      'Deploy en Vercel para proyectos Next.js',
      'Netlify con Serverless Functions',
      'Deploy full-stack sin servidor propio',
    ],
  },
  {
    id: 'automatizacion',
    label: '⚡ Automatización',
    temas: [
      'Flujos automáticos con Make.com',
      'Webhooks e integraciones entre servicios',
    ],
  },
  {
    id: 'video',
    label: '🎬 Video',
    temas: [
      'Generación y edición de video con Shotstack',
      'Thumbnails dinámicos con Microlink API',
    ],
  },
];

const REDES = [
  { id: 'LinkedIn',  label: 'LinkedIn',  icon: '💼', color: '#0A66C2' },
  { id: 'Instagram', label: 'Instagram', icon: '📷', color: '#E1306C' },
  { id: 'Facebook',  label: 'Facebook',  icon: '👥', color: '#1877F2' },
  { id: 'all',       label: 'Todas',     icon: '🌐', color: '#7c3aed' },
];

const TONOS = [
  { id: 'profesional', label: 'Profesional' },
  { id: 'casual',      label: 'Casual' },
  { id: 'técnico',     label: 'Técnico' },
];

const STATUS = { idle: 'idle', sending: 'sending', success: 'success', error: 'error' };

export default function SocialPublisher() {
  const [selectedRed,       setSelectedRed]       = useState('LinkedIn');
  const [selectedCategoria, setSelectedCategoria] = useState(null);
  const [selectedTema,      setSelectedTema]      = useState(null);
  const [selectedTono,      setSelectedTono]      = useState('profesional');
  const [imageUrl,          setImageUrl]          = useState('');
  const [status,            setStatus]            = useState(STATUS.idle);
  const [errorMsg,          setErrorMsg]          = useState('');

  const redActual = REDES.find(r => r.id === selectedRed);
  const categoriaActual = CATEGORIAS.find(c => c.id === selectedCategoria);

  const handleCategoriaChange = (catId) => {
    setSelectedCategoria(catId);
    setSelectedTema(null);
    setImageUrl('');
  };

  const handleTemaChange = (tema) => {
    setSelectedTema(tema);
    const logoKey = TEMA_LOGO[tema];
    if (logoKey && SERVICE_LOGOS[logoKey]) {
      setImageUrl(SERVICE_LOGOS[logoKey]);
    }
  };

  const handleSend = async () => {
    if (!selectedTema) return;

    setStatus(STATUS.sending);
    setErrorMsg('');

    try {
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic:      selectedTema,
          network:    selectedRed,
          tone:       selectedTono,
          type:       'post',
          aiProvider: 'gemini',
          url:        imageUrl || undefined,
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

  const canSend = selectedTema && status === STATUS.idle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          📢 Publicar en Redes Sociales
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Elegí el tema, la red y el tono — Make.com genera y publica automáticamente
        </p>
      </div>

      {/* 1. Red Social */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
          <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
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
                  : 'border-gray-600 text-gray-300 bg-gray-700/50 hover:border-gray-500'
              }`}
            >
              <span>{r.icon}</span>
              {r.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 2. Categoría */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
          <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">2</span>
          Categoría
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIAS.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoriaChange(cat.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                selectedCategoria === cat.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Tema */}
      <AnimatePresence>
        {categoriaActual && (
          <motion.div
            key={categoriaActual.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-800 rounded-xl p-5 border border-gray-700 overflow-hidden"
          >
            <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
              <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">3</span>
              Tema — <span className="text-gray-400 font-normal">{categoriaActual.label}</span>
            </h3>
            <div className="space-y-2">
              {categoriaActual.temas.map(tema => (
                <button
                  key={tema}
                  onClick={() => handleTemaChange(tema)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all border ${
                    selectedTema === tema
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {selectedTema === tema && <span className="mr-2 text-purple-400">✓</span>}
                  {tema}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Tono */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
          <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {categoriaActual ? '4' : '3'}
          </span>
          Tono
        </h3>
        <div className="flex gap-2">
          {TONOS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTono(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedTono === t.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Imagen */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
          <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {categoriaActual ? '5' : '4'}
          </span>
          Imagen
          {imageUrl && TEMA_LOGO[selectedTema] && SERVICE_LOGOS[TEMA_LOGO[selectedTema]] === imageUrl && (
            <span className="text-xs text-purple-400 font-normal">— logo auto-detectado</span>
          )}
        </h3>

        {/* Preview del logo / imagen */}
        <AnimatePresence mode="wait">
          {imageUrl && (
            <motion.div
              key={imageUrl}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-3 flex items-center justify-center bg-gray-900 rounded-xl p-6 border border-gray-700"
            >
              <img
                src={imageUrl}
                alt="preview"
                className="max-h-24 max-w-full object-contain"
                onError={e => e.target.style.display = 'none'}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="text"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="URL override — o dejá el logo auto-detectado"
          className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 placeholder-gray-500"
        />
        {imageUrl && (
          <button
            onClick={() => setImageUrl('')}
            className="mt-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            ✕ Quitar imagen
          </button>
        )}
      </div>

      {/* Resumen */}
      {selectedTema && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-700/50 rounded-xl p-4 border border-gray-600 text-sm text-gray-300 space-y-1"
        >
          <p><span className="text-gray-500">Red:</span> <span style={{ color: redActual?.color }}>{redActual?.icon} {redActual?.label}</span></p>
          <p><span className="text-gray-500">Tema:</span> {selectedTema}</p>
          <p><span className="text-gray-500">Tono:</span> <span className="capitalize">{selectedTono}</span></p>
          <p><span className="text-gray-500">Imagen:</span> {imageUrl ? <span className="text-green-400">✓ URL cargada</span> : <span className="text-yellow-400">⚠ Sin imagen</span>}</p>
        </motion.div>
      )}

      {/* Botón Enviar */}
      <motion.button
        whileHover={canSend ? { scale: 1.02 } : {}}
        whileTap={canSend ? { scale: 0.98 } : {}}
        onClick={handleSend}
        disabled={!canSend}
        className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: canSend
            ? `linear-gradient(135deg, ${redActual?.color}, #7c3aed)`
            : '#374151',
        }}
      >
        <AnimatePresence mode="wait">
          {status === STATUS.sending && (
            <motion.span
              key="sending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                className="inline-block"
              >
                ◌
              </motion.span>
              Enviando a Make.com...
            </motion.span>
          )}
          {status === STATUS.success && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 text-green-300"
            >
              ✅ Enviado — Make.com está procesando
            </motion.span>
          )}
          {status === STATUS.error && (
            <motion.span
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 text-red-300"
            >
              ❌ {errorMsg || 'Error al enviar'}
            </motion.span>
          )}
          {status === STATUS.idle && (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2"
            >
              🚀 Enviar a Make.com
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}
