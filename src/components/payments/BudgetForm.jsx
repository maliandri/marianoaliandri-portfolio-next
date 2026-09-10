'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LAST_SENT_KEY = 'presupuesto_last_sent';

const SERVICES = [
  {
    category: '🌐 Desarrollo Web',
    items: [
      { id: 'landing',      label: 'Landing Page',          desc: 'Página de conversión de 1 sección, diseño custom, mobile-first',            price: 300  },
      { id: 'web_business', label: 'Sitio Multi-página',    desc: 'Hasta 8 páginas, menú, formulario de contacto, SEO incluido',              price: 700  },
      { id: 'ecommerce',    label: 'E-commerce',            desc: 'Catálogo, carrito, checkout MercadoPago, gestión de stock',                price: 1400 },
      { id: 'webapp',       label: 'Web App / Portal',      desc: 'Autenticación, dashboard, roles de usuario, CRUD completo',                price: 2200 },
      { id: 'blog',         label: 'Blog / Noticias',       desc: 'CMS liviano, categorías, RSS, SEO automático por artículo',                price: 450  },
      { id: 'memberships',  label: 'Membresías / Acceso',   desc: 'Registro, login, contenido protegido, suscripciones',                      price: 900  },
    ],
  },
  {
    category: '⚙️ Funcionalidades',
    items: [
      { id: 'contact_form', label: 'Formulario de contacto', desc: 'Con validación, anti-spam, notificación por email automática',            price: 80   },
      { id: 'booking',      label: 'Reservas / Turnos',      desc: 'Calendario, disponibilidad en tiempo real, confirmación por email',       price: 350  },
      { id: 'payments_mp',  label: 'Pagos MercadoPago',      desc: 'Preferencias, webhooks, confirmación automática, historial',             price: 250  },
      { id: 'user_auth',    label: 'Registro de usuarios',   desc: 'Firebase Auth, Google login, perfil de usuario editable',                price: 220  },
      { id: 'ai_chatbot',   label: 'Chatbot con IA',         desc: 'Gemini 2.5 Flash, entrenado con información de tu negocio',              price: 480  },
      { id: 'search',       label: 'Búsqueda interna',       desc: 'Full-text search sobre contenido del sitio en tiempo real',              price: 180  },
      { id: 'analytics_ga', label: 'Analytics integrado',    desc: 'Google Analytics 4, Search Console, eventos y conversiones',             price: 100  },
      { id: 'inventory',    label: 'Inventario / Stock',     desc: 'Alta/baja de productos, alertas de stock mínimo, reportes',              price: 380  },
      { id: 'crm_basic',    label: 'CRM básico',             desc: 'Registro de leads, estados, notas e historial de contacto',              price: 500  },
      { id: 'multilang',    label: 'Multi-idioma',           desc: 'ES/EN, i18n con Next.js, URLs localizadas por idioma',                   price: 280  },
    ],
  },
  {
    category: '🔍 SEO & Posicionamiento',
    items: [
      { id: 'seo_technical', label: 'SEO técnico completo',      desc: 'Sitemap, robots.txt, canonical, Core Web Vitals optimizado',         price: 350  },
      { id: 'seo_meta',      label: 'Metadata & Open Graph',     desc: 'Titles, descriptions, OG tags para compartir en redes sociales',     price: 120  },
      { id: 'seo_schema',    label: 'Schema markup JSON-LD',     desc: 'Rich snippets para Google: negocio local, servicios, FAQ',           price: 120  },
      { id: 'seo_gsc',       label: 'Google Search Console',     desc: 'Alta, verificación, monitoreo de posiciones y clics',                price: 90   },
      { id: 'seo_speed',     label: 'Optimización de velocidad', desc: 'Imágenes, lazy load, CDN Cloudinary, PageSpeed score 90+',          price: 250  },
    ],
  },
  {
    category: '📱 Redes Sociales & Automatización',
    items: [
      { id: 'social_instagram', label: 'Auto-publicación Instagram', desc: 'Webhook → Make.com → Instagram Graph API, fotos y videos',       price: 350  },
      { id: 'social_facebook',  label: 'Auto-publicación Facebook',  desc: 'Integración Graph API, posts de foto, texto y álbumes',         price: 300  },
      { id: 'social_linkedin',  label: 'Auto-publicación LinkedIn',  desc: 'OAuth, posts de artículos, actualizaciones y estadísticas',     price: 300  },
      { id: 'reel_generator',   label: 'Generador de reels',         desc: 'Canvas 1080x1920, voz TTS, música, upload automático a IG',     price: 600  },
      { id: 'post_generator',   label: 'Publicaciones con IA',       desc: 'Gemini genera captions con datos reales de tu negocio',         price: 250  },
      { id: 'cron_social',      label: 'Programador de publicaciones',desc: 'Calendario semanal, publicación automática por horario',       price: 350  },
      { id: 'make_automations', label: 'Automatizaciones Make.com',  desc: 'Flujos multi-paso, routers condicionales, módulos conectados',  price: 280  },
    ],
  },
  {
    category: '🏗️ Infraestructura & Deploy',
    items: [
      { id: 'domain',       label: 'Registro de dominio',      desc: '.com.ar, .com, configuración DNS completa, redirección www',          price: 30   },
      { id: 'email_setup',  label: 'Correo profesional',       desc: 'Zoho/Gmail con tu dominio, MX records, SPF/DKIM anti-spam',          price: 90   },
      { id: 'ssl_cdn',      label: 'SSL + CDN imágenes',       desc: 'HTTPS automático, Cloudinary para imágenes súper rápidas',           price: 100  },
      { id: 'deploy_vercel',label: 'Deploy en Vercel',         desc: 'CI/CD automático desde GitHub, previews por rama',                   price: 120  },
      { id: 'whatsapp_api', label: 'Gateway WhatsApp',         desc: 'Mensajes automáticos desde panel admin, notificaciones',             price: 400  },
    ],
  },
  {
    category: '🗄️ Base de Datos & Backend',
    items: [
      { id: 'db_firestore',    label: 'Firebase Firestore',      desc: 'NoSQL en tiempo real, reglas de seguridad, queries avanzados',      price: 180  },
      { id: 'db_supabase',     label: 'Supabase PostgreSQL',     desc: 'SQL, Row Level Security, API REST auto-generada, Auth',            price: 180  },
      { id: 'db_mongodb',      label: 'MongoDB Atlas',           desc: 'Documentos flexibles, índices compuestos, agregaciones',           price: 180  },
      { id: 'api_custom',      label: 'API Routes custom',       desc: 'Endpoints serverless en Next.js, autenticación JWT',               price: 280  },
      { id: 'backend_nodejs',  label: 'Backend Node.js/Express', desc: 'API REST completa con autenticación, Mongoose, middleware',        price: 550  },
      { id: 'webhooks',        label: 'Webhooks e integraciones',desc: 'Conexión con servicios externos, Make.com, Zapier, N8N',          price: 200  },
    ],
  },
  {
    category: '🤖 IA & Procesamiento',
    items: [
      { id: 'ai_content',  label: 'Generación de contenido IA', desc: 'Gemini genera textos, captions, descripciones de productos',        price: 250  },
      { id: 'ai_document', label: 'Análisis de documentos IA',  desc: 'PDF upload, extracción de datos, resúmenes automáticos',           price: 400  },
      { id: 'tts',         label: 'Text-to-Speech',             desc: 'Google TTS en español AR, voz natural para videos y reels',        price: 180  },
      { id: 'lead_finder', label: 'Lead Finder',                desc: 'Google Places API, scraping de emails y contactos, CSV',           price: 500  },
    ],
  },
  {
    category: '📊 Analytics & Datos',
    items: [
      { id: 'powerbi',           label: 'Dashboard Power BI',       desc: 'KPIs interactivos, actualización automática, compartible',      price: 400  },
      { id: 'recharts_dashboard',label: 'Dashboard web con gráficos',desc: 'Recharts: barras, líneas, área, pie charts en tiempo real',   price: 500  },
      { id: 'excel_automation',  label: 'Excel / Power Query',      desc: 'Macros, ETL, dashboards dinámicos sin código adicional',       price: 250  },
      { id: 'scraping',          label: 'Web Scraping',             desc: 'Python/Node, datos de competidores, precios MeLi',             price: 320  },
      { id: 'gsc_dashboard',     label: 'Dashboard Search Console', desc: 'Clicks, impresiones, posición y evolución semanal',            price: 250  },
    ],
  },
  {
    category: '📄 Exportación & Documentos',
    items: [
      { id: 'pdf_export',    label: 'Exportación a PDF',        desc: 'jsPDF + html2canvas, documentos profesionales desde el sistema',   price: 180  },
      { id: 'qr_code',       label: 'Códigos QR',               desc: 'QR dinámicos de productos, links, menús, contacto vCard',         price: 90   },
      { id: 'excel_export',  label: 'Exportación a Excel',      desc: 'Reportes XLSX descargables desde dashboards y listados',          price: 120  },
      { id: 'google_sheets', label: 'Integración Google Sheets', desc: 'Lectura/escritura de hojas de cálculo como base de datos',       price: 180  },
    ],
  },
  {
    category: '🗺️ Mapas & Geo',
    items: [
      { id: 'maps_leaflet',   label: 'Mapas interactivos',    desc: 'Leaflet + react-leaflet, markers, polígonos de zonas, rutas',       price: 380  },
      { id: 'calendar_system',label: 'Gestor de agenda',      desc: 'Vista mensual/semanal, eventos, disponibilidad online',             price: 380  },
      { id: 'admin_panel',    label: 'Panel admin completo',  desc: 'CRUD, roles, estadísticas, gestión de contenido y usuarios',        price: 800  },
    ],
  },
  {
    category: '📱 Mobile',
    items: [
      { id: 'mobile_app', label: 'App React Native', desc: 'Expo, Android e iOS, gestos avanzados, diseño nativo',                       price: 2500 },
      { id: 'mobile_pwa', label: 'Progressive Web App', desc: 'App instalable desde el browser, notificaciones push, offline',          price: 500  },
    ],
  },
];

const STEPS = ['Datos', 'Servicios', 'Resumen'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            i === current ? 'bg-indigo-600 text-white' :
            i < current  ? 'bg-indigo-600/20 text-indigo-400' :
                           'bg-white/5 text-gray-600'
          }`}>
            <span>{i + 1}</span>
            <span>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
        </div>
      ))}
    </div>
  );
}

function ServiceCard({ item, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.id)}
      className={`relative text-left p-4 rounded-xl border transition-all duration-200 ${
        selected
          ? 'border-indigo-500 bg-indigo-600/10'
          : 'border-white/10 bg-[#111] hover:border-white/25'
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
      <p className="font-semibold text-white text-sm pr-6">{item.label}</p>
      <p className="text-gray-500 text-xs mt-1 leading-relaxed">{item.desc}</p>
      {item.price && (
        <p className={`text-xs font-semibold mt-2 ${selected ? 'text-indigo-400' : 'text-gray-600'}`}>
          desde USD {item.price.toLocaleString()}
        </p>
      )}
    </button>
  );
}

export default function BudgetForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientCompany: '', projectDescription: '', deadline: '' });
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState(null); // { email, servicesCount, when } — de una visita anterior

  // Si ya mandaste una solicitud antes (mismo navegador), lo mostramos en vez de un
  // formulario vacío — evita reenvíos por las dudas de "¿esto se habrá enviado?".
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_SENT_KEY);
      if (raw) setLastSent(JSON.parse(raw));
    } catch { /* localStorage no disponible */ }
  }, []);

  const toggleService = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allServices = SERVICES.flatMap(c => c.items);
  const selectedItems = allServices.filter(s => selected.has(s.id));
  const estimatedTotal = selectedItems.reduce((sum, s) => sum + (s.price || 0), 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/presupuesto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, selectedServices: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setDone(true);
      try {
        localStorage.setItem(LAST_SENT_KEY, JSON.stringify({
          email: form.clientEmail, servicesCount: selectedItems.length, when: new Date().toISOString(),
        }));
      } catch { /* localStorage no disponible */ }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-20"
      >
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">¡Solicitud enviada!</h2>
        <p className="text-gray-400 max-w-md mx-auto">
          Recibí tu solicitud con {selectedItems.length} servicios seleccionados. Te respondo en menos de 24 horas con el presupuesto detallado.
        </p>
        <p className="text-gray-600 text-sm mt-4">📧 Revisá {form.clientEmail}</p>
      </motion.div>
    );
  }

  // Ya mandó una solicitud antes desde este navegador y todavía no tocó nada del
  // formulario actual — se lo mostramos en vez de un formulario vacío, para que no
  // reenvíe por las dudas. Si de verdad quiere mandar otra, puede seguir de largo.
  if (lastSent && step === 0 && !form.clientName && !form.projectDescription) {
    const when = new Date(lastSent.when).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <p className="text-3xl mb-4">✅</p>
        <h2 className="text-xl font-bold text-white mb-3">Ya enviaste una solicitud</h2>
        <p className="text-gray-400 max-w-md mx-auto text-sm">
          El {when} enviaste una solicitud con {lastSent.servicesCount} servicio{lastSent.servicesCount !== 1 ? 's' : ''}
          {lastSent.email ? <> a nombre de <span className="text-white">{lastSent.email}</span></> : ''}.
          Si todavía no te respondimos, dentro de las 24 horas te llega el presupuesto — no hace falta reenviarla.
        </p>
        <button
          onClick={() => setLastSent(null)}
          className="mt-6 text-indigo-400 hover:text-indigo-300 text-sm underline"
        >
          Necesito enviar una solicitud distinta →
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <StepIndicator current={step} />

      <AnimatePresence mode="wait">

        {/* PASO 1 — Datos del cliente */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {[
                { name: 'clientName',    label: 'Nombre completo *',  placeholder: 'Juan García',            type: 'text',  required: true },
                { name: 'clientEmail',   label: 'Email *',            placeholder: 'juan@empresa.com',       type: 'email', required: true },
                { name: 'clientPhone',   label: 'Teléfono / WhatsApp',placeholder: '+54 299 555-0000',       type: 'tel',   required: false },
                { name: 'clientCompany', label: 'Empresa / Negocio',  placeholder: 'Nombre de tu empresa',   type: 'text',  required: false },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-sm text-gray-400 mb-2">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.name]}
                    onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none transition-colors"
                    required={f.required}
                  />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Descripción del proyecto *</label>
              <textarea
                placeholder="Contame brevemente qué necesitás. Cuanto más detalle, mejor el presupuesto."
                value={form.projectDescription}
                onChange={e => setForm(p => ({ ...p, projectDescription: e.target.value }))}
                rows={4}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none transition-colors resize-none"
              />
            </div>
            <div className="mb-8">
              <label className="block text-sm text-gray-400 mb-2">¿Tenés fecha límite?</label>
              <input
                type="text"
                placeholder="Ej: Necesito el sitio para fin de mes, o sin fecha límite"
                value={form.deadline}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={() => {
                if (!form.clientName || !form.clientEmail || !form.projectDescription) {
                  setError('Por favor completá nombre, email y descripción del proyecto.');
                  return;
                }
                setError('');
                setStep(1);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              Siguiente → Elegir servicios
            </button>
            {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
          </motion.div>
        )}

        {/* PASO 2 — Servicios */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="flex items-center justify-center gap-4 mb-6 text-sm">
              <span className="text-gray-500">Seleccioná todos los servicios que necesitás.</span>
              {selected.size > 0 && (
                <span className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold">
                  {selected.size} seleccionados · desde USD {estimatedTotal.toLocaleString()}
                </span>
              )}
            </div>
            <div className="space-y-8">
              {SERVICES.map(cat => (
                <div key={cat.category}>
                  <h3 className="text-indigo-400 text-sm font-semibold tracking-wide uppercase mb-3">{cat.category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cat.items.map(item => (
                      <ServiceCard key={item.id} item={item} selected={selected.has(item.id)} onToggle={toggleService} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-10">
              <button onClick={() => setStep(0)} className="flex-1 border border-white/10 hover:border-white/25 text-white py-3.5 rounded-xl transition-colors">
                ← Volver
              </button>
              <button
                onClick={() => {
                  if (selected.size === 0) { setError('Seleccioná al menos un servicio.'); return; }
                  setError('');
                  setStep(2);
                }}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-colors"
              >
                Ver resumen →
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
          </motion.div>
        )}

        {/* PASO 3 — Resumen */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 mb-6">
              <h3 className="text-white font-bold mb-4">Resumen de tu solicitud</h3>
              <div className="space-y-1 mb-5 text-sm">
                <p><span className="text-gray-500">Nombre:</span> <span className="text-white">{form.clientName}</span></p>
                <p><span className="text-gray-500">Email:</span> <span className="text-white">{form.clientEmail}</span></p>
                {form.clientPhone && <p><span className="text-gray-500">Teléfono:</span> <span className="text-white">{form.clientPhone}</span></p>}
                {form.clientCompany && <p><span className="text-gray-500">Empresa:</span> <span className="text-white">{form.clientCompany}</span></p>}
                {form.deadline && <p><span className="text-gray-500">Fecha límite:</span> <span className="text-white">{form.deadline}</span></p>}
              </div>
              <div className="border-t border-white/5 pt-4">
                <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Servicios seleccionados ({selectedItems.length})</p>
                <div className="space-y-1.5 mb-4">
                  {selectedItems.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-3">
                      <span className="text-gray-300 text-sm">{s.label}</span>
                      {s.price && (
                        <span className="text-gray-500 text-xs whitespace-nowrap">desde USD {s.price.toLocaleString()}</span>
                      )}
                    </div>
                  ))}
                </div>
                {estimatedTotal > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-white/8">
                    <span className="text-sm text-gray-400 font-medium">Total estimado</span>
                    <div className="text-right">
                      <span className="text-white font-bold text-lg">USD {estimatedTotal.toLocaleString()}</span>
                      <p className="text-gray-700 text-[10px] mt-0.5">precio orientativo · puede variar según alcance</p>
                    </div>
                  </div>
                )}
              </div>
              {form.projectDescription && (
                <div className="border-t border-white/5 pt-4 mt-4">
                  <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Descripción</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{form.projectDescription}</p>
                </div>
              )}
            </div>

            <p className="text-gray-600 text-xs text-center mb-6">
              Al enviar aceptás que Mariano Aliandri te contacte para elaborar el presupuesto. Sin compromisos.
            </p>

            {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-white/10 hover:border-white/25 text-white py-3.5 rounded-xl transition-colors">
                ← Modificar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors"
              >
                {submitting ? 'Enviando...' : 'Enviar solicitud de presupuesto'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
