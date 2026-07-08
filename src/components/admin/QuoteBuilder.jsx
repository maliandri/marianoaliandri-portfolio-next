'use client';

import { useState, useMemo, useRef } from 'react';

const SERVICES = [
  { category: '🌐 Desarrollo Web', items: [
    { id: 'landing',      label: 'Landing Page',          desc: 'Página de conversión de 1 sección, diseño custom, mobile-first' },
    { id: 'web_business', label: 'Sitio Multi-página',    desc: 'Hasta 8 páginas, menú, formulario de contacto, SEO incluido' },
    { id: 'ecommerce',    label: 'E-commerce',            desc: 'Catálogo, carrito, checkout MercadoPago, gestión de stock' },
    { id: 'webapp',       label: 'Web App / Portal',      desc: 'Autenticación, dashboard, roles de usuario, CRUD completo' },
    { id: 'blog',         label: 'Blog / Noticias',       desc: 'CMS liviano, categorías, RSS, SEO automático por artículo' },
    { id: 'memberships',  label: 'Membresías / Acceso',   desc: 'Registro, login, contenido protegido, suscripciones' },
  ]},
  { category: '⚙️ Funcionalidades', items: [
    { id: 'contact_form', label: 'Formulario de contacto', desc: 'Con validación, anti-spam, notificación por email automática' },
    { id: 'booking',      label: 'Reservas / Turnos',      desc: 'Calendario, disponibilidad en tiempo real, confirmación por email' },
    { id: 'payments_mp',  label: 'Pagos MercadoPago',      desc: 'Preferencias, webhooks, confirmación automática, historial' },
    { id: 'user_auth',    label: 'Registro de usuarios',   desc: 'Firebase Auth, Google login, perfil de usuario editable' },
    { id: 'ai_chatbot',   label: 'Chatbot con IA',         desc: 'Gemini 2.5 Flash, entrenado con información de tu negocio' },
    { id: 'search',       label: 'Búsqueda interna',       desc: 'Full-text search sobre contenido del sitio en tiempo real' },
    { id: 'analytics_ga', label: 'Analytics integrado',    desc: 'Google Analytics 4, Search Console, eventos y conversiones' },
    { id: 'inventory',    label: 'Inventario / Stock',     desc: 'Alta/baja de productos, alertas de stock mínimo, reportes' },
    { id: 'crm_basic',    label: 'CRM básico',             desc: 'Registro de leads, estados, notas e historial de contacto' },
    { id: 'multilang',    label: 'Multi-idioma',           desc: 'ES/EN, i18n con Next.js, URLs localizadas por idioma' },
  ]},
  { category: '🔍 SEO & Posicionamiento', items: [
    { id: 'seo_technical', label: 'SEO técnico completo',      desc: 'Sitemap, robots.txt, canonical, Core Web Vitals optimizado' },
    { id: 'seo_meta',      label: 'Metadata & Open Graph',     desc: 'Titles, descriptions, OG tags para redes sociales' },
    { id: 'seo_schema',    label: 'Schema markup JSON-LD',     desc: 'Rich snippets para Google: negocio local, servicios, FAQ' },
    { id: 'seo_gsc',       label: 'Google Search Console',     desc: 'Alta, verificación, monitoreo de posiciones y clics' },
    { id: 'seo_speed',     label: 'Optimización de velocidad', desc: 'Imágenes, lazy load, CDN Cloudinary, PageSpeed 90+' },
  ]},
  { category: '📱 Redes & Automatización', items: [
    { id: 'social_instagram', label: 'Auto-publicación Instagram', desc: 'Webhook → Make.com → Instagram Graph API' },
    { id: 'social_facebook',  label: 'Auto-publicación Facebook',  desc: 'Integración Graph API, posts de foto y texto' },
    { id: 'social_linkedin',  label: 'Auto-publicación LinkedIn',  desc: 'OAuth, posts de artículos y actualizaciones' },
    { id: 'reel_generator',   label: 'Generador de reels',         desc: 'Canvas 1080x1920, voz TTS, música, upload a IG' },
    { id: 'post_generator',   label: 'Publicaciones con IA',       desc: 'Gemini genera captions con datos de tu negocio' },
    { id: 'make_automations', label: 'Automatizaciones Make.com',  desc: 'Flujos multi-paso, routers, módulos conectados' },
  ]},
  { category: '🏗️ Infraestructura & Deploy', items: [
    { id: 'domain',       label: 'Registro de dominio',   desc: '.com.ar / .com, DNS, redirección www' },
    { id: 'email_setup',  label: 'Correo profesional',    desc: 'Zoho / Gmail con tu dominio, SPF/DKIM' },
    { id: 'ssl_cdn',      label: 'SSL + CDN imágenes',    desc: 'HTTPS automático, Cloudinary' },
    { id: 'deploy_vercel',label: 'Deploy en Vercel',      desc: 'CI/CD desde GitHub, previews automáticos' },
    { id: 'whatsapp_api', label: 'Gateway WhatsApp',      desc: 'Mensajes automáticos, notificaciones' },
  ]},
  { category: '🗄️ Base de Datos & Backend', items: [
    { id: 'db_firestore',   label: 'Firebase Firestore',       desc: 'NoSQL en tiempo real, reglas de seguridad' },
    { id: 'db_supabase',    label: 'Supabase PostgreSQL',      desc: 'SQL, Row Level Security, API auto-generada' },
    { id: 'db_mongodb',     label: 'MongoDB Atlas',            desc: 'Documentos flexibles, índices, agregaciones' },
    { id: 'api_custom',     label: 'API Routes custom',        desc: 'Endpoints serverless en Next.js, JWT' },
    { id: 'backend_nodejs', label: 'Backend Node.js/Express',  desc: 'API REST con autenticación y Mongoose' },
    { id: 'webhooks',       label: 'Webhooks e integraciones', desc: 'Make.com, Zapier, N8N, servicios externos' },
  ]},
  { category: '🤖 IA & Procesamiento', items: [
    { id: 'ai_content',  label: 'Generación de contenido IA', desc: 'Gemini genera textos, captions, descripciones' },
    { id: 'ai_document', label: 'Análisis de documentos IA',  desc: 'PDF upload, extracción de datos, resúmenes' },
    { id: 'tts',         label: 'Text-to-Speech',             desc: 'Google TTS en español AR, voz para videos' },
    { id: 'lead_finder', label: 'Lead Finder',                desc: 'Google Places API, scraping emails, CSV' },
  ]},
  { category: '📊 Analytics & Datos', items: [
    { id: 'powerbi',            label: 'Dashboard Power BI',        desc: 'KPIs interactivos, actualización automática' },
    { id: 'recharts_dashboard', label: 'Dashboard web con gráficos', desc: 'Recharts: barras, líneas, torta en tiempo real' },
    { id: 'excel_automation',   label: 'Excel / Power Query',       desc: 'Macros, ETL, dashboards dinámicos' },
    { id: 'scraping',           label: 'Web Scraping',              desc: 'Python/Node, datos de competidores, MeLi' },
    { id: 'gsc_dashboard',      label: 'Dashboard Search Console',  desc: 'Clicks, impresiones, posición semanal' },
  ]},
  { category: '📄 Documentos & Exportación', items: [
    { id: 'pdf_export',    label: 'Exportación a PDF',        desc: 'jsPDF + html2canvas, documentos profesionales' },
    { id: 'excel_export',  label: 'Exportación a Excel',      desc: 'Reportes XLSX descargables desde dashboards' },
    { id: 'google_sheets', label: 'Integración Google Sheets',desc: 'Lectura/escritura de hojas como base de datos' },
    { id: 'qr_code',       label: 'Códigos QR',               desc: 'QR dinámicos de productos, links, vCard' },
  ]},
  { category: '🗺️ Mapas & Extras', items: [
    { id: 'maps_leaflet',    label: 'Mapas interactivos',    desc: 'Leaflet, markers, polígonos de zonas, rutas' },
    { id: 'calendar_system', label: 'Gestor de agenda',      desc: 'Vista mensual/semanal, eventos, disponibilidad' },
    { id: 'admin_panel',     label: 'Panel admin completo',  desc: 'CRUD, roles, estadísticas, gestión de contenido' },
    { id: 'mobile_app',      label: 'App React Native',      desc: 'Expo, Android e iOS, gestos avanzados' },
    { id: 'mobile_pwa',      label: 'Progressive Web App',   desc: 'Instalable desde browser, notificaciones push' },
  ]},
];

const fmt = (n) =>
  Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function genNumber() {
  const d = new Date();
  const yy  = String(d.getFullYear()).slice(-2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  const rnd = Math.floor(Math.random() * 900) + 100;
  return `MA-${yy}${mm}${dd}-${rnd}`;
}

export default function QuoteBuilder() {
  /* ── Client info ── */
  const [clientName,    setClientName]    = useState('');
  const [clientEmail,   setClientEmail]   = useState('');
  const [clientCompany, setClientCompany] = useState('');

  /* ── Items ── */
  const [items, setItems] = useState([]); // { id, label, desc, priceUSD }

  /* ── Settings ── */
  const [arsRate,    setArsRate]    = useState(1300);
  const [ivaRate,    setIvaRate]    = useState(21);
  const [showIVA,    setShowIVA]    = useState(true);
  const [notes,      setNotes]      = useState('');
  const [validDays,  setValidDays]  = useState(30);
  const [quoteNumber]               = useState(genNumber);

  /* ── UI ── */
  const [search,  setSearch]  = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  /* ── Totals ── */
  const totals = useMemo(() => {
    const subtotalUSD = items.reduce((s, i) => s + (parseFloat(i.priceUSD) || 0), 0);
    const ivaUSD      = showIVA ? subtotalUSD * ivaRate / 100 : 0;
    const totalUSD    = subtotalUSD + ivaUSD;
    return {
      subtotalUSD,
      ivaUSD,
      totalUSD,
      subtotalARS: subtotalUSD * arsRate,
      ivaARS:      ivaUSD * arsRate,
      totalARS:    totalUSD * arsRate,
    };
  }, [items, ivaRate, showIVA, arsRate]);

  /* ── Dates ── */
  const today      = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const validUntil = new Date(Date.now() + validDays * 864e5)
    .toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  /* ── Service handlers ── */
  const toggleService = (svc) => {
    setItems(prev => {
      const exists = prev.find(i => i.id === svc.id);
      if (exists) return prev.filter(i => i.id !== svc.id);
      return [...prev, { id: svc.id, label: svc.label, desc: svc.desc, priceUSD: '' }];
    });
  };

  const setPrice = (id, val) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, priceUSD: val } : i));

  const moveItem = (id, dir) =>
    setItems(prev => {
      const idx  = prev.findIndex(i => i.id === id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr  = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });

  /* ── Filtered services ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SERVICES;
    return SERVICES
      .map(cat => ({ ...cat, items: cat.items.filter(s => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0);
  }, [search]);

  /* ── Print ── */
  const handlePrint = () => window.print();

  /* ── Send email ── */
  const handleSendEmail = async () => {
    if (!clientEmail) { setSendMsg('Ingresá el email del cliente'); return; }
    if (items.length === 0) { setSendMsg('Seleccioná al menos un servicio'); return; }
    setSending(true);
    setSendMsg('');
    try {
      const res = await fetch('/api/presupuesto/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName, clientEmail, clientCompany,
          items, totals, ivaRate, showIVA, arsRate,
          notes, quoteNumber, validDays, today, validUntil,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar');
      setSendMsg('✓ Email enviado correctamente');
    } catch (e) {
      setSendMsg('Error: ' + e.message);
    } finally {
      setSending(false);
      setTimeout(() => setSendMsg(''), 5000);
    }
  };

  /* ── Input class ── */
  const inp = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30';

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qb-print, #qb-print * { visibility: visible !important; }
          #qb-print { position: fixed; inset: 0; z-index: 9999; background: white; padding: 0; margin: 0; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <div className="flex flex-col xl:flex-row gap-6">

        {/* ──────────── LEFT: Picker ──────────── */}
        <div className="xl:w-72 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Servicios</h3>
            {items.length > 0 && (
              <button onClick={() => setItems([])} className="text-xs text-red-400 hover:text-red-500">
                Limpiar ({items.length})
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inp} w-full`}
          />
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.map(cat => (
              <div key={cat.category}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{cat.category}</p>
                <div className="space-y-1">
                  {cat.items.map(svc => {
                    const sel = items.some(i => i.id === svc.id);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => toggleService(svc)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-start gap-2 ${
                          sel
                            ? 'bg-indigo-600/15 border border-indigo-500/40 text-indigo-300'
                            : 'bg-gray-50 dark:bg-gray-800/60 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="mt-0.5 text-[11px] w-3 shrink-0">{sel ? '✓' : '+'}</span>
                        <span>
                          <span className="font-medium block leading-tight">{svc.label}</span>
                          <span className="text-gray-400 dark:text-gray-500 leading-tight block mt-0.5">{svc.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ──────────── RIGHT: Quote ──────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Settings bar */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre" className={`${inp} w-full`} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 block mb-1">Email</label>
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@..." className={`${inp} w-full`} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Empresa</label>
                <input value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="Empresa" className={`${inp} w-full`} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">TC (USD→ARS)</label>
                <input type="number" value={arsRate} onChange={e => setArsRate(Number(e.target.value))} className={`${inp} w-full`} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Validez (días)</label>
                <input type="number" value={validDays} onChange={e => setValidDays(Number(e.target.value))} className={`${inp} w-full`} min={1} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">IVA %</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={ivaRate} onChange={e => setIvaRate(Number(e.target.value))} className={`${inp} w-16`} disabled={!showIVA} />
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                    <input type="checkbox" checked={showIVA} onChange={e => setShowIVA(e.target.checked)} className="accent-indigo-500" />
                    Incluir
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Printable quote area ── */}
          <div id="qb-print" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Header gradient */}
            <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }} className="px-8 py-6 text-white">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-xs tracking-widest uppercase text-indigo-200 mb-1">Propuesta comercial</p>
                  <h2 className="text-2xl font-black tracking-tight">PRESUPUESTO</h2>
                  <p className="text-indigo-200 text-sm mt-1">Mariano Aliandri · Desarrollo Web & Datos</p>
                </div>
                <div className="text-right text-sm shrink-0">
                  <p className="font-bold text-base">N° {quoteNumber}</p>
                  <p className="text-indigo-200 mt-0.5">Fecha: {today}</p>
                  <p className="text-indigo-200">Válido hasta: {validUntil}</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">

              {/* Client info */}
              {(clientName || clientCompany || clientEmail) && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Para</p>
                  {clientName    && <p className="font-semibold text-gray-900 text-base">{clientName}</p>}
                  {clientCompany && <p className="text-gray-600 text-sm">{clientCompany}</p>}
                  {clientEmail   && <p className="text-gray-400 text-sm">{clientEmail}</p>}
                </div>
              )}

              {/* Items table */}
              {items.length === 0 ? (
                <div className="text-center py-14 text-gray-300">
                  <p className="text-5xl mb-3">📋</p>
                  <p className="text-gray-400 text-sm">Seleccioná servicios desde el panel izquierdo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-100">
                        <th className="text-left py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                        <th className="text-left py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-2">Servicio</th>
                        <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Precio USD</th>
                        <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Precio ARS</th>
                        <th className="w-14 text-center py-2.5 print-hide text-xs font-semibold text-gray-400 uppercase tracking-wider">Ord.</th>
                        <th className="w-8 print-hide"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => {
                        const usdVal = parseFloat(item.priceUSD) || 0;
                        return (
                          <tr key={item.id} className="group">
                            <td className="py-3 text-gray-300 text-xs">{idx + 1}</td>
                            <td className="py-3 pl-2">
                              <p className="font-semibold text-gray-900">{item.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                            </td>
                            <td className="py-3 text-right">
                              {/* Editor (hidden on print) */}
                              <div className="flex items-center justify-end gap-1 print:hidden">
                                <span className="text-gray-400 text-xs">USD</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.priceUSD}
                                  onChange={e => setPrice(item.id, e.target.value)}
                                  placeholder="0"
                                  className="w-24 text-right bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white transition-colors"
                                />
                              </div>
                              {/* Print view */}
                              <span className="hidden print:block font-semibold text-gray-900">
                                {usdVal > 0 ? `USD ${fmt(usdVal)}` : <span className="text-gray-300">—</span>}
                              </span>
                            </td>
                            <td className="py-3 text-right text-gray-500">
                              {usdVal > 0 && arsRate > 0
                                ? `ARS ${fmt(usdVal * arsRate)}`
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-3 text-center print:hidden">
                              <div className="flex flex-col gap-0.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => moveItem(item.id, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none">▲</button>
                                <button onClick={() => moveItem(item.id, +1)} disabled={idx === items.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none">▼</button>
                              </div>
                            </td>
                            <td className="py-3 text-right print:hidden">
                              <button
                                onClick={() => toggleService(item)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base w-6"
                              >×</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              {notes && (
                <div className="border-l-2 border-indigo-200 pl-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notas</p>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">{notes}</p>
                </div>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="flex justify-end">
                  <div className="w-80">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1.5 text-gray-500">
                        <span>Subtotal <span className="text-xs">(sin IVA)</span></span>
                        <div className="text-right">
                          <span className="font-semibold text-gray-800">USD {fmt(totals.subtotalUSD)}</span>
                          <br />
                          <span className="text-xs text-gray-400">ARS {fmt(totals.subtotalARS)}</span>
                        </div>
                      </div>
                      {showIVA && (
                        <div className="flex justify-between py-1.5 text-gray-500 border-b border-dashed border-gray-200">
                          <span>IVA ({ivaRate}%)</span>
                          <div className="text-right">
                            <span className="font-semibold text-gray-800">USD {fmt(totals.ivaUSD)}</span>
                            <br />
                            <span className="text-xs text-gray-400">ARS {fmt(totals.ivaARS)}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between py-2.5 border-t-2 border-gray-800">
                        <span className="font-black text-gray-900 text-base">TOTAL</span>
                        <div className="text-right">
                          <span className="font-black text-gray-900 text-xl">USD {fmt(totals.totalUSD)}</span>
                          <br />
                          <span className="text-sm text-gray-500 font-medium">ARS {fmt(totals.totalARS)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-300 space-y-0.5">
                <p className="font-medium text-gray-400">Mariano Aliandri · marianoaliandri.com.ar · marianoaliandri@gmail.com · +54 299 541-4422</p>
                <p>Los precios en USD no incluyen IVA · Tipo de cambio referencial: 1 USD = ARS {arsRate.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </div>

          {/* Notes input (not printed) */}
          <div className="print:hidden">
            <label className="text-xs text-gray-500 block mb-1">Notas / aclaraciones (aparecen en el presupuesto)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Incluye 1 ronda de revisiones. Plazo estimado: 3 semanas..."
              rows={2}
              className={`${inp} w-full resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="print:hidden flex flex-wrap gap-3 items-center pb-4">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-sm font-medium transition-colors"
            >
              🖨️ Descargar PDF
            </button>
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {sending ? '⏳ Enviando...' : '📧 Enviar por email'}
            </button>
            {!clientEmail && (
              <span className="text-xs text-gray-400">Completá el email del cliente para enviar</span>
            )}
            {sendMsg && (
              <span className={`text-sm font-medium ${sendMsg.startsWith('✓') ? 'text-green-500' : 'text-red-400'}`}>
                {sendMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
