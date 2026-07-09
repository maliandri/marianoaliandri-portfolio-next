'use client';

import { useState, useMemo, useEffect } from 'react';

/* ── Service catalogue ─────────────────────────────────────────────── */
const SERVICES = [
  { category: '🌐 Desarrollo Web', items: [
    { id: 'landing',      label: 'Landing Page',          desc: 'Página de conversión, diseño custom, mobile-first' },
    { id: 'web_business', label: 'Sitio Multi-página',    desc: 'Hasta 8 páginas, menú, formulario, SEO' },
    { id: 'ecommerce',    label: 'E-commerce',            desc: 'Catálogo, carrito, MercadoPago, stock' },
    { id: 'webapp',       label: 'Web App / Portal',      desc: 'Auth, dashboard, roles, CRUD completo' },
    { id: 'blog',         label: 'Blog / Noticias',       desc: 'CMS, categorías, RSS, SEO automático' },
    { id: 'memberships',  label: 'Membresías / Acceso',   desc: 'Login, contenido protegido, suscripciones' },
  ]},
  { category: '⚙️ Funcionalidades', items: [
    { id: 'contact_form', label: 'Formulario de contacto', desc: 'Validación, anti-spam, email automático' },
    { id: 'booking',      label: 'Reservas / Turnos',      desc: 'Calendario, disponibilidad, confirmación email' },
    { id: 'payments_mp',  label: 'Pagos MercadoPago',      desc: 'Preferencias, webhooks, historial' },
    { id: 'user_auth',    label: 'Registro de usuarios',   desc: 'Firebase Auth, Google login, perfil editable' },
    { id: 'ai_chatbot',   label: 'Chatbot con IA',         desc: 'Gemini 2.5 Flash, entrenado con tu negocio' },
    { id: 'analytics_ga', label: 'Analytics integrado',    desc: 'GA4, Search Console, eventos custom' },
    { id: 'inventory',    label: 'Inventario / Stock',     desc: 'Alta/baja de productos, alertas, reportes' },
    { id: 'crm_basic',    label: 'CRM básico',             desc: 'Leads, estados, notas, historial' },
    { id: 'multilang',    label: 'Multi-idioma',           desc: 'ES/EN, i18n con Next.js' },
  ]},
  { category: '🔍 SEO & Posicionamiento', items: [
    { id: 'seo_technical', label: 'SEO técnico completo',      desc: 'Sitemap, robots.txt, Core Web Vitals' },
    { id: 'seo_meta',      label: 'Metadata & Open Graph',     desc: 'Titles, descriptions, OG tags' },
    { id: 'seo_schema',    label: 'Schema markup JSON-LD',     desc: 'Rich snippets para Google' },
    { id: 'seo_gsc',       label: 'Google Search Console',     desc: 'Alta, verificación, monitoreo' },
    { id: 'seo_speed',     label: 'Optimización de velocidad', desc: 'Imágenes, lazy load, CDN, PageSpeed 90+' },
  ]},
  { category: '📱 Redes & Automatización', items: [
    { id: 'social_instagram', label: 'Auto-publicación Instagram', desc: 'Webhook → Make.com → IG Graph API' },
    { id: 'social_facebook',  label: 'Auto-publicación Facebook',  desc: 'Graph API, posts de foto y texto' },
    { id: 'social_linkedin',  label: 'Auto-publicación LinkedIn',  desc: 'OAuth, posts y actualizaciones' },
    { id: 'reel_generator',   label: 'Generador de reels',         desc: 'Canvas 1080x1920, TTS, música, upload IG' },
    { id: 'make_automations', label: 'Automatizaciones Make.com',  desc: 'Flujos multi-paso, routers' },
  ]},
  { category: '🏗️ Infraestructura & Deploy', items: [
    { id: 'domain',       label: 'Registro de dominio',   desc: '.com.ar / .com, DNS completo' },
    { id: 'email_setup',  label: 'Correo profesional',    desc: 'Zoho / Gmail con dominio propio' },
    { id: 'ssl_cdn',      label: 'SSL + CDN imágenes',    desc: 'HTTPS automático, Cloudinary' },
    { id: 'deploy_vercel',label: 'Deploy en Vercel',      desc: 'CI/CD desde GitHub, previews' },
    { id: 'whatsapp_api', label: 'Gateway WhatsApp',      desc: 'Mensajes automáticos, notificaciones' },
  ]},
  { category: '🗄️ Base de Datos & Backend', items: [
    { id: 'db_firestore',   label: 'Firebase Firestore',       desc: 'NoSQL en tiempo real, reglas' },
    { id: 'db_supabase',    label: 'Supabase PostgreSQL',      desc: 'SQL, RLS, API auto-generada' },
    { id: 'db_mongodb',     label: 'MongoDB Atlas',            desc: 'Documentos flexibles, agregaciones' },
    { id: 'api_custom',     label: 'API Routes custom',        desc: 'Endpoints serverless, JWT' },
    { id: 'backend_nodejs', label: 'Backend Node.js/Express',  desc: 'API REST con auth y Mongoose' },
    { id: 'webhooks',       label: 'Webhooks e integraciones', desc: 'Make.com, Zapier, N8N' },
  ]},
  { category: '🤖 IA & Procesamiento', items: [
    { id: 'ai_content',  label: 'Generación de contenido IA', desc: 'Gemini: textos, captions, descripciones' },
    { id: 'ai_document', label: 'Análisis de documentos IA',  desc: 'PDF, extracción de datos, resúmenes' },
    { id: 'tts',         label: 'Text-to-Speech',             desc: 'Google TTS español AR' },
    { id: 'lead_finder', label: 'Lead Finder',                desc: 'Google Places API, emails, CSV' },
  ]},
  { category: '📊 Analytics & Datos', items: [
    { id: 'powerbi',            label: 'Dashboard Power BI',        desc: 'KPIs interactivos, actualización automática' },
    { id: 'recharts_dashboard', label: 'Dashboard web con gráficos', desc: 'Recharts: barras, líneas, torta' },
    { id: 'excel_automation',   label: 'Excel / Power Query',       desc: 'Macros, ETL, dashboards' },
    { id: 'scraping',           label: 'Web Scraping',              desc: 'Python/Node, competidores, MeLi' },
  ]},
  { category: '📄 Documentos & Exportación', items: [
    { id: 'pdf_export',    label: 'Exportación a PDF',        desc: 'jsPDF + html2canvas' },
    { id: 'excel_export',  label: 'Exportación a Excel',      desc: 'Reportes XLSX descargables' },
    { id: 'google_sheets', label: 'Integración Google Sheets',desc: 'Lectura/escritura como base de datos' },
    { id: 'qr_code',       label: 'Códigos QR',               desc: 'QR dinámicos, links, vCard' },
  ]},
  { category: '🗺️ Mapas & Extras', items: [
    { id: 'maps_leaflet',    label: 'Mapas interactivos',    desc: 'Leaflet, markers, polígonos' },
    { id: 'calendar_system', label: 'Gestor de agenda',      desc: 'Vista mensual/semanal, eventos' },
    { id: 'admin_panel',     label: 'Panel admin completo',  desc: 'CRUD, roles, estadísticas' },
    { id: 'mobile_app',      label: 'App React Native',      desc: 'Expo, Android e iOS' },
    { id: 'mobile_pwa',      label: 'Progressive Web App',   desc: 'Instalable, notificaciones push' },
  ]},
];

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmt = (n) =>
  Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function genNumber() {
  const d = new Date();
  return `MA-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*900)+100}`;
}

const DEFAULT_CUOTAS = [
  { pct: 50,  label: 'Al inicio' },
  { pct: 50,  label: 'A la entrega' },
  { pct: 0,   label: 'A los 30 días' },
  { pct: 0,   label: 'A los 60 días' },
];

/* ── Resolve initialData items ─────────────────────────────────────── */
const ALL_SERVICES = SERVICES.flatMap(cat => cat.items);
const SVC_MAP = Object.fromEntries(ALL_SERVICES.map(s => [s.id, s]));

function resolveItems(data) {
  if (!data) return [];
  /* saved from QuoteBuilder — has full items array */
  if (Array.isArray(data.items) && data.items.length > 0) return data.items;
  /* from public form — only selectedServices IDs */
  if (Array.isArray(data.selectedServices)) {
    return data.selectedServices
      .map(id => SVC_MAP[id])
      .filter(Boolean)
      .map(s => ({ id: s.id, label: s.label, desc: s.desc, priceUSD: '', discount: 0 }));
  }
  return [];
}

/* ── Component ───────────────────────────────────────────────────────── */
export default function QuoteBuilder({ initialData = null }) {
  /* client */
  const [clientName,    setClientName]    = useState(initialData?.clientName    || '');
  const [clientEmail,   setClientEmail]   = useState(initialData?.clientEmail   || '');
  const [clientCompany, setClientCompany] = useState(initialData?.clientCompany || '');

  /* items: { id, label, desc, priceUSD, discount } */
  const [items, setItems] = useState(() => resolveItems(initialData));

  /* settings */
  const [arsRate,   setArsRate]   = useState(initialData?.arsRate   || 1300);
  const [ivaRate,   setIvaRate]   = useState(initialData?.ivaRate   || 21);
  const [showIVA,   setShowIVA]   = useState(initialData?.showIVA   ?? true);
  const [notes,     setNotes]     = useState(initialData?.projectDescription || initialData?.notes || '');
  const [validDays, setValidDays] = useState(initialData?.validDays || 30);
  const [quoteNumber]             = useState(genNumber);

  /* cuotas */
  const initCuotas  = initialData?.cuotas;
  const [showCuotas,  setShowCuotas]  = useState(!!initCuotas);
  const [numCuotas,   setNumCuotas]   = useState(initCuotas?.numCuotas || 2);
  const [cuotasConf,  setCuotasConf]  = useState(() => {
    if (initCuotas?.items?.length) {
      return initCuotas.items.map(c => ({ pct: c.pct, label: c.label }))
        .concat(DEFAULT_CUOTAS.slice(initCuotas.items.length));
    }
    return DEFAULT_CUOTAS;
  });

  /* ui */
  const [search,  setSearch]  = useState('');
  const [sending, setSending] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ text: '', ok: true });

  /* ── Totals ── */
  const totals = useMemo(() => {
    const brutoUSD    = items.reduce((s, i) => s + (parseFloat(i.priceUSD) || 0), 0);
    const descUSD     = items.reduce((s, i) => s + (parseFloat(i.priceUSD) || 0) * (parseFloat(i.discount) || 0) / 100, 0);
    const netoUSD     = brutoUSD - descUSD;
    const ivaUSD      = showIVA ? netoUSD * ivaRate / 100 : 0;
    const totalUSD    = netoUSD + ivaUSD;
    const hasDiscount = descUSD > 0;
    return {
      brutoUSD, descUSD, netoUSD, ivaUSD, totalUSD,
      brutoARS: brutoUSD * arsRate,
      descARS:  descUSD  * arsRate,
      netoARS:  netoUSD  * arsRate,
      ivaARS:   ivaUSD   * arsRate,
      totalARS: totalUSD * arsRate,
      hasDiscount,
    };
  }, [items, ivaRate, showIVA, arsRate]);

  /* ── Cuotas amounts ── */
  const cuotasAmounts = useMemo(() => {
    return cuotasConf.slice(0, numCuotas).map(c => ({
      label:   c.label,
      pct:     c.pct,
      usd:     totals.totalUSD * c.pct / 100,
      ars:     totals.totalARS * c.pct / 100,
    }));
  }, [cuotasConf, numCuotas, totals]);

  const pctSum = cuotasConf.slice(0, numCuotas).reduce((s, c) => s + (parseFloat(c.pct) || 0), 0);

  /* ── Dates ── */
  const today      = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const validUntil = new Date(Date.now() + validDays * 864e5).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  /* ── Handlers ── */
  const toggleService = (svc) =>
    setItems(prev => prev.find(i => i.id === svc.id)
      ? prev.filter(i => i.id !== svc.id)
      : [...prev, { id: svc.id, label: svc.label, desc: svc.desc, priceUSD: '', discount: 0 }]
    );

  const setField = (id, field, val) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));

  const moveItem = (id, dir) => setItems(prev => {
    const idx = prev.findIndex(i => i.id === id);
    const nxt = idx + dir;
    if (nxt < 0 || nxt >= prev.length) return prev;
    const arr = [...prev];
    [arr[idx], arr[nxt]] = [arr[nxt], arr[idx]];
    return arr;
  });

  const changeCuotas = (n) => {
    setNumCuotas(n);
    const base = Math.floor(100 / n);
    const rem  = 100 - base * n;
    setCuotasConf(prev => prev.map((c, i) => ({
      ...c,
      pct: i < n ? (i === 0 ? base + rem : base) : 0,
    })));
  };

  const setCuotaPct = (i, val) =>
    setCuotasConf(prev => prev.map((c, idx) => idx === i ? { ...c, pct: parseFloat(val) || 0 } : c));

  const setCuotaLabel = (i, val) =>
    setCuotasConf(prev => prev.map((c, idx) => idx === i ? { ...c, label: val } : c));

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 5000); };

  /* ── Shared payload ── */
  const buildPayload = () => ({
    clientName, clientEmail, clientCompany,
    items, totals, ivaRate, showIVA, arsRate,
    notes, quoteNumber, validDays, today, validUntil,
    cuotas: showCuotas ? { numCuotas, items: cuotasAmounts, pctSum } : null,
  });

  /* ── Save to Firestore ── */
  const handleSave = async () => {
    if (!items.length) { flash('Seleccioná al menos un servicio', false); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/presupuesto/save-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      flash(`✓ Guardado (ID: ${data.id})`);
    } catch (e) { flash('Error: ' + e.message, false); }
    finally { setSaving(false); }
  };

  /* ── Send email ── */
  const handleSendEmail = async () => {
    if (!clientEmail) { flash('Ingresá el email del cliente', false); return; }
    if (!items.length) { flash('Seleccioná al menos un servicio', false); return; }
    setSending(true);
    try {
      const res = await fetch('/api/presupuesto/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      flash('✓ Email enviado correctamente');
    } catch (e) { flash('Error: ' + e.message, false); }
    finally { setSending(false); }
  };

  /* ── Filtered services ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SERVICES;
    return SERVICES
      .map(cat => ({ ...cat, items: cat.items.filter(s => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0);
  }, [search]);

  const inp = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30';

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qb-print, #qb-print * { visibility: visible !important; }
          #qb-print { position:fixed;inset:0;z-index:9999;background:white;padding:0;margin:0; }
          @page { margin:1.5cm; size:A4; }
          .no-print { display:none !important; }
        }
      `}</style>

      <div className="flex flex-col xl:flex-row gap-6">

        {/* ──── LEFT: Service picker ──── */}
        <div className="xl:w-64 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Servicios</h3>
            {items.length > 0 && (
              <button onClick={() => setItems([])} className="text-xs text-red-400 hover:text-red-500">
                Limpiar ({items.length})
              </button>
            )}
          </div>
          <input
            type="text" placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inp} w-full`}
          />
          <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            {filtered.map(cat => (
              <div key={cat.category}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{cat.category}</p>
                <div className="space-y-1">
                  {cat.items.map(svc => {
                    const sel = items.some(i => i.id === svc.id);
                    return (
                      <button key={svc.id} onClick={() => toggleService(svc)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-start gap-2 ${
                          sel ? 'bg-indigo-600/15 border border-indigo-500/40 text-indigo-300'
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

        {/* ──── RIGHT: Quote ──── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Banner si viene de una solicitud */}
          {initialData && (
            <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-center gap-3 no-print">
              <span className="text-indigo-400 text-lg">✏️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-300">
                  Editando solicitud de {initialData.clientName || 'cliente'}
                  {initialData.source === 'admin' ? '' : ' (formulario público)'}
                </p>
                <p className="text-xs text-indigo-400/70">
                  {initialData.source !== 'admin' && 'Solicitud pública — los precios deben cargarse manualmente.'}
                  {initialData.source === 'admin' && 'Presupuesto guardado previamente — precios y descuentos cargados.'}
                </p>
              </div>
            </div>
          )}

          {/* Settings bar */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 no-print">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre" className={`${inp} w-full`} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 block mb-1">Email cliente</label>
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
                <input type="number" value={validDays} min={1} onChange={e => setValidDays(Number(e.target.value))} className={`${inp} w-full`} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">IVA %</label>
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

          {/* ── Printable area ── */}
          <div id="qb-print" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }} className="px-8 py-6 text-white">
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

              {/* Client */}
              {(clientName || clientCompany || clientEmail) && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Para</p>
                  {clientName    && <p className="font-bold text-gray-900 text-base">{clientName}</p>}
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
                        <th className="text-left py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-6">#</th>
                        <th className="text-left py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-2">Servicio</th>
                        <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Precio USD</th>
                        <th className="text-center py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24 no-print">Bonif. %</th>
                        <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Total USD</th>
                        <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32 hidden md:table-cell">Total ARS</th>
                        <th className="w-14 text-center no-print"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => {
                        const raw  = parseFloat(item.priceUSD) || 0;
                        const disc = parseFloat(item.discount) || 0;
                        const net  = raw * (1 - disc / 100);
                        return (
                          <tr key={item.id} className="group">
                            <td className="py-3 text-gray-300 text-xs align-top pt-4">{idx + 1}</td>
                            <td className="py-3 pl-2 align-top">
                              <p className="font-semibold text-gray-900">{item.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                            </td>

                            {/* Precio bruto */}
                            <td className="py-3 text-right align-top">
                              <div className="no-print flex items-center justify-end gap-1">
                                <span className="text-gray-400 text-xs">USD</span>
                                <input
                                  type="number" min="0" value={item.priceUSD}
                                  onChange={e => setField(item.id, 'priceUSD', e.target.value)}
                                  placeholder="0"
                                  className="w-24 text-right bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition-colors"
                                />
                              </div>
                              {/* Print: precio bruto solo si hay descuento */}
                              {disc > 0 && (
                                <span className="hidden print:block text-gray-400 line-through text-xs">USD {fmt(raw)}</span>
                              )}
                              {disc === 0 && (
                                <span className="hidden print:block font-semibold text-gray-900 text-sm">
                                  {raw > 0 ? `USD ${fmt(raw)}` : '—'}
                                </span>
                              )}
                            </td>

                            {/* Bonificación */}
                            <td className="py-3 text-center align-top no-print">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number" min="0" max="100" value={item.discount}
                                  onChange={e => setField(item.id, 'discount', Math.min(100, Math.max(0, Number(e.target.value))))}
                                  className="w-16 text-center bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:bg-white transition-colors"
                                />
                                <span className="text-gray-400 text-xs">%</span>
                              </div>
                              {disc > 0 && (
                                <p className="text-orange-500 text-xs mt-0.5">-USD {fmt(raw * disc / 100)}</p>
                              )}
                            </td>

                            {/* Total neto */}
                            <td className="py-3 text-right align-top">
                              <span className={`font-semibold text-sm ${disc > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                {net > 0 ? `USD ${fmt(net)}` : <span className="text-gray-300">—</span>}
                              </span>
                              {disc > 0 && (
                                <p className="text-xs text-orange-500 print:hidden">-{disc}%</p>
                              )}
                            </td>

                            {/* ARS */}
                            <td className="py-3 text-right align-top text-gray-400 text-xs hidden md:table-cell">
                              {net > 0 && arsRate > 0 ? `ARS ${fmt(net * arsRate)}` : '—'}
                            </td>

                            {/* Controls */}
                            <td className="py-3 text-center align-top no-print">
                              <div className="flex flex-col gap-0.5 items-center opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                                <button onClick={() => moveItem(item.id, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">▲</button>
                                <button onClick={() => moveItem(item.id, +1)} disabled={idx === items.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">▼</button>
                              </div>
                              <button onClick={() => toggleService(item)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base">×</button>
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
                  <div className="w-84 min-w-72 space-y-1.5 text-sm">
                    {totals.hasDiscount && (
                      <>
                        <div className="flex justify-between py-1 text-gray-400">
                          <span>Subtotal bruto</span>
                          <div className="text-right">
                            <span className="font-medium text-gray-600">USD {fmt(totals.brutoUSD)}</span>
                            <br /><span className="text-xs text-gray-300">ARS {fmt(totals.brutoARS)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between py-1 text-orange-500">
                          <span>Bonificaciones</span>
                          <div className="text-right">
                            <span className="font-semibold">- USD {fmt(totals.descUSD)}</span>
                            <br /><span className="text-xs text-orange-300">- ARS {fmt(totals.descARS)}</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between py-1.5 text-gray-500 border-t border-dashed border-gray-200">
                      <span>Subtotal <span className="text-xs">(sin IVA)</span></span>
                      <div className="text-right">
                        <span className="font-semibold text-gray-800">USD {fmt(totals.netoUSD)}</span>
                        <br /><span className="text-xs text-gray-400">ARS {fmt(totals.netoARS)}</span>
                      </div>
                    </div>
                    {showIVA && (
                      <div className="flex justify-between py-1.5 text-gray-500 border-b border-dashed border-gray-200">
                        <span>IVA ({ivaRate}%)</span>
                        <div className="text-right">
                          <span className="font-semibold text-gray-800">USD {fmt(totals.ivaUSD)}</span>
                          <br /><span className="text-xs text-gray-400">ARS {fmt(totals.ivaARS)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between py-3 border-t-2 border-gray-800">
                      <span className="font-black text-gray-900 text-base">TOTAL</span>
                      <div className="text-right">
                        <span className="font-black text-gray-900 text-xl">USD {fmt(totals.totalUSD)}</span>
                        <br /><span className="text-sm text-gray-500 font-medium">ARS {fmt(totals.totalARS)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Plan de pagos ── */}
              {showCuotas && items.length > 0 && (
                <div className="border border-indigo-100 rounded-xl overflow-hidden">
                  <div className="bg-indigo-50 px-5 py-3 flex items-center justify-between">
                    <h4 className="font-semibold text-indigo-800 text-sm">Plan de pagos — {numCuotas} cuota{numCuotas > 1 ? 's' : ''}</h4>
                    {Math.abs(pctSum - 100) > 0.1 && (
                      <span className="text-xs text-orange-500 font-medium">⚠ Suma: {pctSum.toFixed(0)}% (debe ser 100%)</span>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-indigo-50/50">
                      <tr>
                        <th className="text-left px-5 py-2 text-xs font-semibold text-indigo-600">Concepto</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-indigo-600 no-print">%</th>
                        <th className="text-right px-5 py-2 text-xs font-semibold text-indigo-600">USD</th>
                        <th className="text-right px-5 py-2 text-xs font-semibold text-indigo-600 hidden md:table-cell">ARS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-50">
                      {cuotasAmounts.map((c, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3">
                            <span className="no-print">
                              <input
                                value={cuotasConf[i].label}
                                onChange={e => setCuotaLabel(i, e.target.value)}
                                className="bg-transparent border-b border-dashed border-indigo-300 focus:outline-none text-gray-700 text-sm w-40"
                              />
                            </span>
                            <span className="hidden print:inline font-medium text-gray-800">{c.label}</span>
                          </td>
                          <td className="px-3 py-3 text-center no-print">
                            <div className="flex items-center gap-1 justify-center">
                              <input
                                type="number" min="0" max="100"
                                value={cuotasConf[i].pct}
                                onChange={e => setCuotaPct(i, e.target.value)}
                                className="w-14 text-center bg-gray-100 rounded-lg px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              />
                              <span className="text-gray-400 text-xs">%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-800">
                            USD {fmt(c.usd)}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-400 text-xs hidden md:table-cell">
                            ARS {fmt(c.ars)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-300 space-y-0.5">
                <p className="font-medium text-gray-400">Mariano Aliandri · marianoaliandri.com.ar · marianoaliandri@gmail.com · +54 299 541-4422</p>
                <p>Los precios en USD no incluyen IVA · Tipo de cambio referencial: 1 USD = ARS {arsRate.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </div>

          {/* ── Controls below quote (no-print) ── */}
          <div className="no-print space-y-3">

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notas / aclaraciones (aparecen en el presupuesto)</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ej: Incluye 1 ronda de revisiones. Plazo estimado: 3 semanas..."
                rows={2} className={`${inp} w-full resize-none`}
              />
            </div>

            {/* Cuotas toggle + config */}
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={showCuotas} onChange={e => setShowCuotas(e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Plan de pagos en cuotas</span>
              </label>
              {showCuotas && (
                <div className="space-y-3 pl-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-gray-500">Número de cuotas:</span>
                    {[1, 2, 3, 4].map(n => (
                      <button
                        key={n}
                        onClick={() => changeCuotas(n)}
                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors ${
                          numCuotas === n
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    {Array.from({ length: numCuotas }, (_, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400 w-16 text-xs">Cuota {i + 1}</span>
                        <input
                          value={cuotasConf[i].label}
                          onChange={e => setCuotaLabel(i, e.target.value)}
                          className={`${inp} flex-1 py-1.5`}
                          placeholder="Descripción"
                        />
                        <input
                          type="number" min="0" max="100"
                          value={cuotasConf[i].pct}
                          onChange={e => setCuotaPct(i, e.target.value)}
                          className={`${inp} w-20 text-center py-1.5`}
                        />
                        <span className="text-gray-400 text-xs">%</span>
                        <span className="text-indigo-600 font-medium text-xs w-28 text-right">
                          USD {fmt(totals.totalUSD * (parseFloat(cuotasConf[i].pct) || 0) / 100)}
                        </span>
                      </div>
                    ))}
                    {Math.abs(pctSum - 100) > 0.1 && (
                      <p className="text-xs text-orange-500">Suma total: {pctSum.toFixed(1)}% — debe ser exactamente 100%</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 items-center pb-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                🖨️ PDF
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {sending ? '⏳ Enviando...' : '📧 Enviar email'}
              </button>
              {!clientEmail && (
                <span className="text-xs text-gray-400">Completá el email para enviar</span>
              )}
              {msg.text && (
                <span className={`text-sm font-medium ${msg.ok ? 'text-green-500' : 'text-red-400'}`}>{msg.text}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
