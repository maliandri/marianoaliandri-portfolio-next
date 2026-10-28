'use client';

import { useEffect, useMemo, useState } from 'react';
import { track } from '@/lib/track';

// Tienda de servicios: el cliente arma su proyecto, ve el total en USD y en pesos, y paga la seña o el
// total con MercadoPago, o pide presupuesto. El monto que se cobra lo calcula el servidor (/api/tienda/);
// acá solo se muestra. Firma visual: la "orden de trabajo" de la derecha, con troquel y números en mono.

const PUNTOS_DE_PARTIDA = [
  { label: 'Landing para mostrar tu negocio', ids: ['landing', 'contact_form', 'domain', 'deploy_vercel'] },
  { label: 'Sitio con varias páginas', ids: ['web_business', 'seo_technical', 'domain', 'email_setup', 'deploy_vercel'] },
  { label: 'Tienda online que cobra', ids: ['ecommerce', 'payments_mp', 'domain', 'deploy_vercel'] },
  { label: 'Tu negocio conectado a Claude', ids: ['claude_mcp', 'admin_panel', 'db_supabase', 'deploy_vercel'] },
];

const usd = (n) => `US$ ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const ars = (n) => `$ ${Math.round(n || 0).toLocaleString('es-AR')}`;
const modoInfo = (sena) => ({
  sena: { titulo: `Seña del ${Math.round(sena * 100)}%`, detalle: 'Pagás una parte para arrancar y el resto durante el proyecto.' },
  total: { titulo: 'Pago total', detalle: 'Pagás todo ahora con 10% de descuento.' },
  presupuesto: { titulo: 'Pedir presupuesto', detalle: 'Sin pagar: te escribo en menos de 24 h.' },
});

export default function TiendaServicios({ iniciales = [] }) {
  const [data, setData] = useState(null);
  const [cargaError, setCargaError] = useState('');
  const [elegidos, setElegidos] = useState(() => new Set(iniciales));
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [modo, setModo] = useState('sena');
  const [cliente, setCliente] = useState({ nombre: '', email: '', telefono: '', empresa: '', notas: '' });
  const [trampa, setTrampa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(null);

  useEffect(() => {
    fetch('/api/tienda/')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        // Abiertas de entrada: la primera categoría y las que tienen algo preelegido.
        setAbiertas(new Set([d.catalogo[0]?.category, ...d.catalogo.filter(c => c.items.some(i => iniciales.includes(i.id))).map(c => c.category)]));
      })
      .catch(() => setCargaError('No se pudo cargar el catálogo. Recargá la página o escribime por WhatsApp.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => (data?.catalogo || []).flatMap(c => c.items), [data]);
  const elegidosLista = items.filter(i => elegidos.has(i.id));
  const subtotal = elegidosLista.reduce((t, i) => t + i.priceUSD, 0);
  const descuento = modo === 'total' ? subtotal * 0.1 : 0;
  const total = subtotal - descuento;
  const senaPct = data?.senaPct || 0.5;
  const aPagar = modo === 'sena' ? total * senaPct : modo === 'total' ? total : 0;
  const cot = data?.cotizacion;

  const toggle = (id) => {
    setElegidos(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else { n.add(id); track('add_to_cart', { item_id: id }); }
      return n;
    });
  };
  const usarPunto = (ids) => { setElegidos(new Set(ids)); ids.forEach(id => track('add_to_cart', { item_id: id })); };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!elegidosLista.length) { setError('Elegí al menos un servicio de la lista.'); return; }
    setEnviando(true);
    track(modo === 'presupuesto' ? 'cta_presupuesto' : 'checkout_tienda', { value: aPagar, currency: 'USD' });
    try {
      // Si la persona tiene sesión, el pago queda además en /mis-compras. Firebase se carga recién acá.
      let token = null;
      try {
        const { firebaseAuth } = await import('@/utils/firebaseservice');
        token = await firebaseAuth.getCurrentUser()?.getIdToken();
      } catch { /* sin sesión */ }
      const res = await fetch('/api/tienda/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ servicios: [...elegidos], modo, cliente, website: trampa }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudo procesar el pedido');
      if (d.init_point) { window.location.href = d.init_point; return; }
      setListo(d.id);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-fg-500">Pedido #{listo.slice(0, 6)}</p>
        <h2 className="mt-3 text-3xl font-bold text-fg">Recibí tu pedido</h2>
        <p className="mt-3 text-fg-400">Te mandé un mail con el detalle a {cliente.email}. En menos de 24 h te escribo con el presupuesto final y los próximos pasos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-32 lg:pb-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      {/* Catálogo */}
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-fg-300">¿No sabés por dónde empezar? Elegí una base y después sumá o sacá lo que quieras.</p>
          <div className="flex flex-wrap gap-2">
            {PUNTOS_DE_PARTIDA.map(p => (
              <button key={p.label} type="button" onClick={() => usarPunto(p.ids)} disabled={!data}
                className="px-3.5 py-2 rounded-full border border-fg-500/30 text-sm text-fg-200 hover:border-accent-primary hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-accent-primary transition-colors disabled:opacity-50">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {cargaError && <p role="alert" className="text-red-600 dark:text-red-400">{cargaError}</p>}
        {!data && !cargaError && <div className="h-64 rounded-2xl bg-card-2 animate-pulse" aria-label="Cargando catálogo" />}

        {data?.catalogo.map(cat => {
          const abierta = abiertas.has(cat.category);
          const cuantos = cat.items.filter(i => elegidos.has(i.id)).length;
          return (
            <section key={cat.category} className="rounded-2xl bg-card border border-fg-500/15">
              <button type="button" aria-expanded={abierta}
                onClick={() => setAbiertas(prev => { const n = new Set(prev); n.has(cat.category) ? n.delete(cat.category) : n.add(cat.category); return n; })}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline-2 focus-visible:outline-accent-primary rounded-2xl">
                <span className="font-semibold text-fg">{cat.category}</span>
                <span className="flex items-center gap-3 text-sm text-fg-500">
                  {cuantos > 0 && <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-accent-primary text-white">{cuantos}</span>}
                  <span aria-hidden className={`transition-transform ${abierta ? 'rotate-180' : ''}`}>▾</span>
                </span>
              </button>
              {abierta && (
                <ul className="border-t border-fg-500/15 divide-y divide-fg-500/10">
                  {cat.items.map(s => {
                    const on = elegidos.has(s.id);
                    return (
                      <li key={s.id}>
                        <label className={`flex gap-4 px-5 py-4 cursor-pointer transition-colors ${on ? 'bg-accent-primary/5' : 'hover:bg-card-2'}`}>
                          <input type="checkbox" checked={on} onChange={() => toggle(s.id)}
                            className="mt-1 h-4 w-4 shrink-0 accent-[#4c01f9]" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                              <span className="font-medium text-fg">{s.label}</span>
                              <span className="font-mono text-sm text-fg-300 tabular-nums">{usd(s.priceUSD)}</span>
                            </span>
                            <span className="block text-sm text-fg-500">{s.desc}</span>
                            {on && <span className="block mt-1.5 text-sm text-fg-400">{s.benefit}</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* Orden de trabajo */}
      <form id="orden" onSubmit={enviar} className="lg:sticky lg:top-24 rounded-2xl bg-card border border-fg-500/20 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold text-fg">Tu orden de trabajo</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg-500">{elegidosLista.length} ítem{elegidosLista.length === 1 ? '' : 's'}</span>
          </div>
          {elegidosLista.length === 0 ? (
            <p className="mt-4 text-sm text-fg-500">Marcá los servicios que necesitás y acá se arma el total.</p>
          ) : (
            <ul className="mt-4 space-y-2 font-mono text-[13px] tabular-nums">
              {elegidosLista.map(i => (
                <li key={i.id} className="flex items-baseline gap-2 text-fg-300">
                  <button type="button" onClick={() => toggle(i.id)} aria-label={`Sacar ${i.label}`} className="text-fg-500 hover:text-red-500">×</button>
                  <span className="min-w-0 truncate font-sans text-sm">{i.label}</span>
                  <span className="border-b border-dotted border-fg-500/40 flex-1 min-w-3 translate-y-[-3px]" aria-hidden />
                  <span>{usd(i.priceUSD)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* troquel */}
        <div className="relative h-4" aria-hidden>
          <div className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-fg-500/25" />
          <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-page border border-fg-500/20" />
          <div className="absolute -right-2 top-0 h-4 w-4 rounded-full bg-page border border-fg-500/20" />
        </div>

        <div className="px-5 pt-3 pb-5 space-y-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-fg mb-2">¿Cómo seguimos?</legend>
            {Object.entries(modoInfo(senaPct)).map(([id, m]) => (
              <label key={id} className={`flex gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${modo === id ? 'border-accent-primary bg-accent-primary/5' : 'border-fg-500/20 hover:border-fg-500/40'}`}>
                <input type="radio" name="modo" value={id} checked={modo === id} onChange={() => setModo(id)} className="mt-1 accent-[#4c01f9]" />
                <span>
                  <span className="block text-sm font-medium text-fg">{m.titulo}</span>
                  <span className="block text-xs text-fg-500">{m.detalle}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <dl className="font-mono text-[13px] tabular-nums space-y-1">
            <div className="flex justify-between text-fg-400"><dt>Subtotal</dt><dd>{usd(subtotal)}</dd></div>
            {descuento > 0 && <div className="flex justify-between text-green-600 dark:text-green-400"><dt>Descuento 10%</dt><dd>−{usd(descuento)}</dd></div>}
            <div className="flex justify-between text-fg font-semibold"><dt>Total del proyecto</dt><dd>{usd(total)}</dd></div>
            {modo !== 'presupuesto' && (
              <div className="pt-2 mt-2 border-t border-fg-500/15">
                <div className="flex justify-between items-baseline text-fg">
                  <dt className="font-sans text-sm font-semibold">{modo === 'sena' ? 'Pagás hoy (seña)' : 'Pagás hoy'}</dt>
                  <dd className="text-xl font-bold">{cot ? ars(aPagar * cot) : usd(aPagar)}</dd>
                </div>
                {cot && <p className="text-right text-[11px] text-fg-500">{usd(aPagar)} · dólar oficial {ars(cot)}</p>}
                {!cot && data && <p className="text-[11px] text-amber-600">Sin cotización del dólar ahora: probá en unos minutos o pedí presupuesto.</p>}
              </div>
            )}
          </dl>

          <div className="grid gap-2.5">
            <input required placeholder="Tu nombre" autoComplete="name" value={cliente.nombre} onChange={e => setCliente({ ...cliente, nombre: e.target.value })}
              className="w-full rounded-lg border border-fg-500/25 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary" />
            <input required type="email" placeholder="Email" autoComplete="email" value={cliente.email} onChange={e => setCliente({ ...cliente, email: e.target.value })}
              className="w-full rounded-lg border border-fg-500/25 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary" />
            <div className="grid grid-cols-2 gap-2.5">
              <input placeholder="WhatsApp" autoComplete="tel" value={cliente.telefono} onChange={e => setCliente({ ...cliente, telefono: e.target.value })}
                className="w-full min-w-0 rounded-lg border border-fg-500/25 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary" />
              <input placeholder="Negocio" autoComplete="organization" value={cliente.empresa} onChange={e => setCliente({ ...cliente, empresa: e.target.value })}
                className="w-full min-w-0 rounded-lg border border-fg-500/25 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary" />
            </div>
            <textarea rows={2} placeholder="Contame en dos líneas qué necesitás (opcional)" value={cliente.notas} onChange={e => setCliente({ ...cliente, notas: e.target.value })}
              className="w-full rounded-lg border border-fg-500/25 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary" />
            <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={trampa} onChange={e => setTrampa(e.target.value)} name="website" />
          </div>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={enviando || !data || (modo !== 'presupuesto' && !cot)}
            className="w-full rounded-xl bg-accent-primary text-white font-semibold py-3 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary disabled:opacity-50">
            {enviando ? (modo === 'presupuesto' ? 'Enviando…' : 'Abriendo MercadoPago…')
              : modo === 'presupuesto' ? 'Pedir presupuesto' : 'Pagar con MercadoPago'}
          </button>
          <p className="text-[11px] leading-relaxed text-fg-500">
            Precios en dólares, cobrados en pesos al dólar oficial del día. El hosting en Vercel y Cloudinary tiene plan gratis para la mayoría de los negocios; si tu sitio lo supera, te aviso antes.
          </p>
        </div>
      </form>

      {/* Barra del celular: total y salto a la orden */}
      {elegidosLista.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur border-t border-fg-500/20 px-4 py-3 flex items-center justify-between gap-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="font-mono text-sm tabular-nums text-fg">{elegidosLista.length} · {usd(total)}</span>
          <a href="#orden" className="rounded-lg bg-accent-primary text-white text-sm font-semibold px-4 py-2">Ver mi orden</a>
        </div>
      )}
    </div>
  );
}
