'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/firebaseservice';
import cloudinaryService from '../../utils/cloudinaryService';

const SERVICIOS = [
  { id: 'sitio-web', nombre: 'Sitio Web Profesional', descripcion: 'Desarrollo de sitios web modernos con Next.js/React, SEO optimizado, diseño responsive y velocidad de carga óptima.', emoji: '🌐' },
  { id: 'ecommerce', nombre: 'E-Commerce', descripcion: 'Tienda online completa con carrito, MercadoPago, gestión de productos, panel admin y notificaciones automáticas.', emoji: '🛒' },
  { id: 'dashboard-bi', nombre: 'Dashboard Power BI', descripcion: 'Dashboards interactivos con Power BI, DAX, Excel avanzado y visualizaciones para toma de decisiones de negocio.', emoji: '📊' },
  { id: 'chatbot-ia', nombre: 'Chatbot con IA', descripcion: 'Chatbot inteligente integrado en tu sitio con Google Gemini, captura de leads, respuestas automáticas 24/7.', emoji: '🤖' },
  { id: 'automatizacion', nombre: 'Automatización', descripcion: 'Automatizaciones con Make.com, webhooks, integraciones entre herramientas y flujos de trabajo sin código manual.', emoji: '⚡' },
  { id: 'landing-page', nombre: 'Landing Page', descripcion: 'Landing pages optimizadas para conversión con animaciones Framer Motion, formularios de contacto y Google Analytics.', emoji: '🚀' },
  { id: 'seo', nombre: 'SEO y Posicionamiento', descripcion: 'Auditoría SEO, implementación técnica, Google Search Console, sitemap XML, Schema.org y estrategia de contenido.', emoji: '🔍' },
  { id: 'app-mobile', nombre: 'App Mobile', descripcion: 'Aplicaciones móviles con React Native o Kotlin, publicadas en Play Store, con diseño nativo y notificaciones push.', emoji: '📱' },
  { id: 'consultoria', nombre: 'Consultoría Digital', descripcion: 'Asesoramiento estratégico en transformación digital, elección de stack tecnológico y roadmap de producto.', emoji: '💡' },
  { id: 'integracion-mercadopago', nombre: 'Integración MercadoPago', descripcion: 'Integración completa de pagos con MercadoPago: checkout, webhooks, suscripciones recurrentes y gestión de órdenes.', emoji: '💳' },
];

const REDES = [
  { id: 'instagram', nombre: 'Instagram', color: '#E1306C', icon: '📷' },
  { id: 'linkedin', nombre: 'LinkedIn', color: '#0A66C2', icon: '💼' },
  { id: 'facebook', nombre: 'Facebook', color: '#1877F2', icon: '👥' },
  { id: 'whatsapp', nombre: 'WhatsApp', color: '#25D366', icon: '💬' },
];

const TONOS = [
  { id: 'profesional', label: 'Profesional', desc: 'B2B · LinkedIn' },
  { id: 'cercano', label: 'Cercano', desc: 'IG · FB' },
  { id: 'urgente', label: 'Urgente', desc: 'Oferta limitada' },
  { id: 'educativo', label: 'Educativo', desc: 'Agrega valor' },
];

// ─── Preview Mockups ──────────────────────────────────────────────────────────

function PreviewInstagram({ caption, hashtags, imagenSrc, servicio }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-600 bg-black w-full max-w-xs mx-auto">
      <div className="flex items-center gap-2 p-3 border-b border-gray-700">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-orange-400 to-yellow-400 flex items-center justify-center text-white text-xs font-bold shrink-0">MA</div>
        <div>
          <p className="text-white text-xs font-semibold">marianoaliandri</p>
          <p className="text-gray-400 text-xs">Argentina</p>
        </div>
      </div>
      <div className="aspect-square bg-gray-800 flex items-center justify-center relative">
        {imagenSrc ? (
          <img src={imagenSrc} alt="post" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-gray-500">
            <div className="text-5xl mb-2">{servicio?.emoji || '📷'}</div>
            <p className="text-xs">Imagen del post</p>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex gap-3 text-lg mb-2">❤️ 💬 ✈️</div>
        <p className="text-white text-xs leading-relaxed line-clamp-3">
          <span className="font-semibold">marianoaliandri</span>{' '}
          {caption || <span className="text-gray-500">Tu caption aparecerá aquí...</span>}
        </p>
        {hashtags.length > 0 && (
          <p className="text-pink-400 text-xs mt-1 line-clamp-1">{hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}</p>
        )}
      </div>
    </div>
  );
}

function PreviewLinkedIn({ caption, hashtags, imagenSrc }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-600 bg-gray-900 w-full max-w-sm mx-auto">
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">MA</div>
        <div>
          <p className="text-white text-sm font-semibold">Mariano Aliandri</p>
          <p className="text-gray-400 text-xs">Full Stack Developer & Data Analyst</p>
          <p className="text-gray-500 text-xs">hace 1 hora · 🌐</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <p className="text-gray-200 text-sm leading-relaxed line-clamp-4">
          {caption || <span className="text-gray-500">Tu caption aparecerá aquí...</span>}
        </p>
        {hashtags.length > 0 && (
          <p className="text-blue-400 text-xs mt-2">{hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}</p>
        )}
      </div>
      {imagenSrc && (
        <div className="aspect-video bg-gray-800">
          <img src={imagenSrc} alt="post" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex gap-4 p-3 border-t border-gray-700 text-gray-400 text-xs">
        <span>👍 Me gusta</span>
        <span>💬 Comentar</span>
        <span>↩️ Compartir</span>
      </div>
    </div>
  );
}

function PreviewFacebook({ caption, hashtags, imagenSrc }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-600 bg-gray-900 w-full max-w-sm mx-auto">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold shrink-0">MA</div>
        <div>
          <p className="text-white text-sm font-semibold">Mariano Aliandri</p>
          <p className="text-gray-500 text-xs">hace 1 hora · 🌐 Público</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <p className="text-gray-200 text-sm leading-relaxed line-clamp-4">
          {caption || <span className="text-gray-500">Tu caption aparecerá aquí...</span>}
        </p>
        {hashtags.length > 0 && (
          <p className="text-blue-400 text-xs mt-2">{hashtags.slice(0, 4).map(h => `#${h}`).join(' ')}</p>
        )}
      </div>
      {imagenSrc && (
        <div className="aspect-video bg-gray-800">
          <img src={imagenSrc} alt="post" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex gap-4 p-3 border-t border-gray-700 text-gray-400 text-xs">
        <span>👍 Me gusta</span>
        <span>💬 Comentar</span>
        <span>↩️ Compartir</span>
      </div>
    </div>
  );
}

function PreviewWhatsApp({ caption, imagenSrc }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-600 w-full max-w-xs mx-auto">
      <div className="bg-green-900 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold shrink-0">MA</div>
        <span className="text-white text-sm font-semibold">Mariano Aliandri</span>
      </div>
      <div className="p-4 bg-gray-800 min-h-24 flex flex-col justify-end">
        <div className="bg-green-700 text-white text-xs p-3 rounded-lg rounded-tl-none max-w-xs leading-relaxed">
          {imagenSrc && <img src={imagenSrc} alt="post" className="w-full rounded-md mb-2" />}
          {caption || <span className="text-green-200 opacity-60">Tu mensaje aparecerá aquí...</span>}
          <p className="text-green-200 text-xs mt-1 text-right opacity-70">✓✓ 12:00</p>
        </div>
      </div>
    </div>
  );
}

function PostPreview({ red, caption, hashtags, imagenSrc, servicio }) {
  const previews = {
    instagram: <PreviewInstagram caption={caption} hashtags={hashtags} imagenSrc={imagenSrc} servicio={servicio} />,
    linkedin: <PreviewLinkedIn caption={caption} hashtags={hashtags} imagenSrc={imagenSrc} />,
    facebook: <PreviewFacebook caption={caption} hashtags={hashtags} imagenSrc={imagenSrc} />,
    whatsapp: <PreviewWhatsApp caption={caption} imagenSrc={imagenSrc} />,
  };
  return previews[red] || null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SocialPublisher() {
  const [selectedServicio, setSelectedServicio] = useState(null);
  const [selectedRed, setSelectedRed] = useState('instagram');
  const [selectedTono, setSelectedTono] = useState('cercano');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [newHashtag, setNewHashtag] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [toast, setToast] = useState({ show: false, type: '', message: '' });
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const redActual = REDES.find(r => r.id === selectedRed);
  const imagenSrc = imagenUrl || imagePreview || '';

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(collection(db, 'social_posts'), orderBy('publicadoEn', 'desc'), limit(10));
      const snap = await getDocs(q);
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Error cargando historial social:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 4000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setImagenUrl('');
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagenUrl('');
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!selectedServicio) { showToast('error', 'Elegí un servicio primero'); return; }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-social-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicioId: selectedServicio.id,
          servicioNombre: selectedServicio.nombre,
          descripcion: selectedServicio.descripcion,
          red: selectedRed,
          tono: selectedTono,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCaption(data.caption);
        setHashtags(data.hashtags || []);
      } else {
        showToast('error', data.error || 'Error generando caption');
      }
    } catch {
      showToast('error', 'Error de conexión con la IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!caption) { showToast('error', 'Escribí o generá un caption primero'); return; }
    setIsPublishing(true);
    try {
      let finalImageUrl = imagenUrl;

      if (imagePreview && !imagenUrl) {
        setIsUploadingImage(true);
        try {
          finalImageUrl = await cloudinaryService.uploadBase64Image(imagePreview, 'social-posts');
        } catch {
          showToast('error', 'Error subiendo imagen a Cloudinary');
          setIsPublishing(false);
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          red: selectedRed,
          caption,
          hashtags,
          imagenUrl: finalImageUrl,
          servicioId: selectedServicio?.id || '',
          servicioNombre: selectedServicio?.nombre || '',
          tono: selectedTono,
        }),
      });
      const data = await res.json();

      if (data.success) {
        try {
          await addDoc(collection(db, 'social_posts'), {
            servicioId: selectedServicio?.id || '',
            servicioNombre: selectedServicio?.nombre || '',
            red: selectedRed,
            caption,
            hashtags,
            imagenUrl: finalImageUrl,
            tono: selectedTono,
            publicadoEn: serverTimestamp(),
            status: 'publicado',
          });
        } catch (e) {
          console.error('Error guardando en Firestore:', e);
        }

        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setCaption('');
          setHashtags([]);
          setImagenUrl('');
          setImagePreview('');
          setSelectedServicio(null);
          loadHistory();
        }, 2500);
      } else {
        showToast('error', data.error || 'Error al publicar');
      }
    } catch {
      showToast('error', 'Error de conexión al publicar');
    } finally {
      setIsPublishing(false);
    }
  };

  const addHashtag = () => {
    const tag = newHashtag.replace(/^#/, '').trim();
    if (tag && !hashtags.includes(tag)) {
      setHashtags(prev => [...prev, tag]);
      setNewHashtag('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          📢 Publicar en Redes Sociales
        </h2>
        <p className="text-gray-400 text-sm mt-1">Generá captions con IA y publicá directo desde acá</p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium pointer-events-none ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
              className="bg-gray-900 border border-green-500 rounded-2xl p-14 text-center shadow-2xl"
            >
              <motion.div
                className="text-7xl mb-4"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 0.6 }}
              >
                🚀
              </motion.div>
              <h3 className="text-2xl font-bold text-green-400">¡Publicado!</h3>
              <p className="text-gray-400 mt-2">Tu post fue enviado a Make.com</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Left: Controls ── */}
        <div className="space-y-4">

          {/* 1. Servicio */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
              <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
              Elegí el servicio
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {SERVICIOS.map(s => (
                <motion.button
                  key={s.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedServicio(s)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedServicio?.id === s.id
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                  }`}
                >
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <div className="text-xs font-medium leading-tight">{s.nombre}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* 2. Red Social */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
              <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">2</span>
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
                  {r.nombre}
                </motion.button>
              ))}
            </div>
          </div>

          {/* 3. Tono */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
              <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">3</span>
              Tono
            </h3>
            <div className="flex gap-2 flex-wrap">
              {TONOS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTono(t.id)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all text-left ${
                    selectedTono === t.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs opacity-60">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Imagen */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
              <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">4</span>
              Imagen <span className="text-gray-500 font-normal">(opcional)</span>
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imagenUrl}
                  onChange={e => { setImagenUrl(e.target.value); setImagePreview(''); }}
                  placeholder="Pegar URL de imagen..."
                  className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 placeholder-gray-500"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg border border-gray-600 transition-colors whitespace-nowrap"
                >
                  📁 Subir
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              {imagenSrc && (
                <div className="relative">
                  <img src={imagenSrc} alt="preview" className="w-full h-32 object-cover rounded-lg" />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white text-xs px-2 py-1 rounded-md transition-colors"
                  >
                    ✕ Quitar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Generar IA */}
          <motion.button
            whileHover={!isGenerating && selectedServicio ? { scale: 1.02 } : {}}
            whileTap={!isGenerating && selectedServicio ? { scale: 0.98 } : {}}
            onClick={handleGenerate}
            disabled={isGenerating || !selectedServicio}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: !isGenerating && selectedServicio
                ? `linear-gradient(135deg, #7c3aed, ${redActual?.color})`
                : '#374151',
            }}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block text-lg"
                >
                  ✦
                </motion.span>
                Generando con IA...
              </span>
            ) : (
              '✨ Generar Caption con IA'
            )}
          </motion.button>
        </div>

        {/* ── Right: Preview + Editor ── */}
        <div className="space-y-4">

          {/* Preview */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
              <span>👁️</span> Preview
              <span className="ml-auto text-xs font-normal" style={{ color: redActual?.color }}>
                {redActual?.icon} {redActual?.nombre}
              </span>
            </h3>
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedRed}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <PostPreview
                  red={selectedRed}
                  caption={caption}
                  hashtags={hashtags}
                  imagenSrc={imagenSrc}
                  servicio={selectedServicio}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Caption Editor */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
              <span>✏️</span> Caption
            </h3>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Generá un caption con IA o escribí uno propio..."
              rows={6}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 resize-none placeholder-gray-500"
            />
            <p className="text-gray-500 text-xs mt-1 text-right">{caption.length} caracteres</p>
          </div>

          {/* Hashtags */}
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
              <span>#</span> Hashtags
            </h3>
            <div className="flex flex-wrap gap-2 mb-3 min-h-8">
              <AnimatePresence>
                {hashtags.map(tag => (
                  <motion.span
                    key={tag}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600/30 text-purple-300 text-xs rounded-full border border-purple-600/50"
                  >
                    #{tag}
                    <button
                      onClick={() => setHashtags(prev => prev.filter(h => h !== tag))}
                      className="text-purple-400 hover:text-red-400 transition-colors ml-0.5 leading-none"
                    >
                      ✕
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
              {hashtags.length === 0 && (
                <span className="text-gray-500 text-xs self-center">Los hashtags aparecerán aquí...</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newHashtag}
                onChange={e => setNewHashtag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHashtag()}
                placeholder="agregar hashtag..."
                className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 placeholder-gray-500"
              />
              <button
                onClick={addHashtag}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors font-medium"
              >
                +
              </button>
            </div>
          </div>

          {/* Publish Button */}
          <motion.button
            whileHover={!isPublishing && caption ? { scale: 1.02 } : {}}
            whileTap={!isPublishing && caption ? { scale: 0.98 } : {}}
            onClick={handlePublish}
            disabled={isPublishing || !caption}
            className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: caption && !isPublishing
                ? `linear-gradient(135deg, ${redActual?.color}, #7c3aed)`
                : '#374151',
            }}
          >
            {isPublishing ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block"
                >
                  ◌
                </motion.span>
                {isUploadingImage ? 'Subiendo imagen...' : 'Publicando...'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                🚀 Publicar en {redActual?.nombre}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      {/* ── History ── */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <span>📋</span> Historial de publicaciones
          </h3>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-gray-400 hover:text-white text-xs transition-colors disabled:opacity-50"
          >
            🔄 Actualizar
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No hay publicaciones aún</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-700">
                  <th className="text-left py-2 pr-4 font-medium">Servicio</th>
                  <th className="text-left py-2 pr-4 font-medium">Red</th>
                  <th className="text-left py-2 pr-4 font-medium">Tono</th>
                  <th className="text-left py-2 pr-4 font-medium">Estado</th>
                  <th className="text-left py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {history.map(post => {
                  const red = REDES.find(r => r.id === post.red);
                  const fecha = post.publicadoEn?.toDate?.()?.toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  });
                  return (
                    <tr key={post.id} className="border-b border-gray-700/40 text-gray-300 hover:bg-gray-700/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-xs">{post.servicioNombre || '—'}</td>
                      <td className="py-2.5 pr-4 text-xs">
                        <span style={{ color: red?.color }}>{red?.icon} {post.red}</span>
                      </td>
                      <td className="py-2.5 pr-4 capitalize text-xs text-gray-400">{post.tono}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          post.status === 'publicado'
                            ? 'bg-green-600/25 text-green-400'
                            : 'bg-gray-600/30 text-gray-400'
                        }`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 text-xs">{fecha || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
