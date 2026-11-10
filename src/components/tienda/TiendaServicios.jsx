'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/track';
import { resolverDependencias } from '@/lib/tiendaDeps';
import { RECETAS } from '@/data/tiendaRecetas';

// Tienda de servicios: el cliente arma su proyecto sumando piezas (base + secciones + módulos). El catálogo se
// ve sin precios; para ver los precios y el total hay que iniciar sesión con Google (los precios los sirve
// /api/tienda/precios/ solo con idToken). El monto que se cobra lo calcula SIEMPRE el servidor (/api/tienda/);
// acá solo se muestra. Firebase se carga recién después de hidratar para no ensuciar el LCP.
// Firma visual: la "orden de trabajo" de la derecha, con troquel y números en mono.

const usd = (n) => `US$ ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const ars = (n) => `$ ${Math.round(n || 0).toLocaleString('es-AR')}`;
const modoInfo = (sena) => ({
  sena: { titulo: `Seña del ${Math.round(sena * 100)}%`, detalle: 'Pagás una parte para arrancar y el resto durante el proyecto.' },
  total: { titulo: 'Pago total', detalle: 'Pagás todo ahora con 10% de descuento.' },
  presupuesto: { titulo: 'Pedir presupuesto', detalle: 'Sin pagar: te escribo en menos de 24 h.' },
});

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default function TiendaServicios({ catalogo = [] }) {
  const items = useMemo(() => catalogo.flatMap(c => c.items), [catalogo]);
  const mapa = useMemo(() => new Map(items.map(s => [s.id, s])), [items]);

  const authRef = useRef(null);
  const [user, setUser] = useState(null);
  const [authListo, setAuthListo] = useState(false);
  const [datos, setDatos] = useState(null); // { precios, cotizacion, senaPct } — solo con sesión
  const [preciosError, setPreciosError] = useState('');
  const [elegidos, setElegidos] = useState(() => new Set());
  const [cantidades, setCantidades] = useState({});
  const [abiertas, setAbiertas] = useState(() => new Set([catalogo[0]?.category]));
  const [modo, setModo] = useState('sena');
  const [cliente, setCliente] = useState({ nombre: '', email: '', telefono: '', empresa: '', notas: '' });
  const [trampa, setTrampa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(null);

  // Preselección por URL (?servicios=a,b): se lee acá y no en el servidor para que la página siga siendo estática.
  useEffect(() => {
    const ids = new URLSearchParams(window.location.search).get('servicios');
    if (!ids) return;
    const validos = ids.split(',').map(s => s.trim()).filter(id => mapa.has(id)).slice(0, 30);
    if (!validos.length) return;
    setElegidos(new Set(validos));
    setAbiertas(new Set([catalogo[0]?.category, ...catalogo.filter(c => c.items.some(i => validos.includes(i.id))).map(c => c.category)]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sesión de Google (Firebase se importa después de hidratar).
  useEffect(() => {
    let unsub = null;
    let vivo = true;
    import('@/utils/firebaseservice').then(({ firebaseAuth }) => {
      if (!vivo) return;
      authRef.current = firebaseAuth;
      unsub = firebaseAuth.onAuthChange((u) => { setUser(u); setAuthListo(true); });
    }).catch(() => setAuthListo(true));
    return () => { vivo = false; if (unsub) unsub(); };
  }, []);

  // Con sesión: precios + cotización (el servidor los niega sin token).
  useEffect(() => {
    if (!user) { setDatos(null); return; }
    let vivo = true;
    (async () => {
      try {
        const token = await authRef.current?.getCurrentUser()?.getIdToken();
        const res = await fetch('/api/tienda/precios/', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'No se pudieron cargar los precios');
        if (vivo) { setDatos(d); setPreciosError(''); }
      } catch (e) {
        if (vivo) setPreciosError(e.message || 'No se pudieron cargar los precios. Recargá la página o escribime por WhatsApp.');
      }
    })();
    setCliente(c => ({ ...c, nombre: c.nombre || user.displayName || '', email: c.email || user.email || '' }));
    return () => { vivo = false; };
  }, [user]);

  const login = async () => {
    setError('');
    try { await authRef.current?.loginWithGoogle(); } catch { setError('No se pudo iniciar sesión. Probá de nuevo.'); }
  };

  const { ids: todosIds, agregados } = useMemo(() => resolverDependencias([...elegidos], items), [elegidos, items]);
  const lista = todosIds.map(id => mapa.get(id)).filter(Boolean);
  const cant = (s) => (s.porUnidad ? Math.max(1, cantidades[s.id] || 1) : 1);
  const precioDe = (s) => (datos?.precios?.[s.id] != null ? datos.precios[s.id] * cant(s) : null);

  const subtotal = lista.reduce((t, s) => t + (precioDe(s) || 0), 0);
  const descuento = modo === 'total' ? subtotal * 0.1 : 0;
  const total = subtotal - descuento;
  const senaPct = datos?.senaPct || 0.5;
  const aPagar = modo === 'sena' ? total * senaPct : modo === 'total' ? total : 0;
  const cot = datos?.cotizacion;

  const toggle = (id) => {
    setElegidos(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else { n.add(id); track('add_to_cart', { item_id: id }); }
      return n;
    });
  };
  const cambiarCantidad = (id, delta) => setCantidades(prev => ({ ...prev, [id]: Math.min(20, Math.max(1, (prev[id] || 1) + delta)) }));
  const usarPunto = (ids) => {
    const validos = ids.filter(id => mapa.has(id));
    setElegidos(new Set(validos));
    validos.forEach(id => track('add_to_cart', { item_id: id }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) { await login(); return; }
    if (!lista.length) { setError('Elegí al menos una pieza de la lista.'); return; }
    setEnviando(true);
    track(modo === 'presupuesto' ? 'cta_presupuesto' : 'checkout_tienda', { value: aPagar, currency: 'USD' });
    try {
      const token = await authRef.current?.getCurrentUser()?.getIdToken();
      const res = await fetch('/api/tienda/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ servicios: [...elegidos], cantidades, modo, cliente, website: trampa }),
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

  const cargandoPrecios = user && !datos && !preciosError;
  const inputCls = 'w-full rounded-lg border border-fg-500/25 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary';

  return (
    <div className="max-w-6xl mx-auto px-4 pb-32 lg:pb-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      {/* Catálogo */}
      <div className="min-w-0 space-y-6">
        {authListo && !user && (
          <div className="rounded-2xl border border-accent-primary/30 bg-accent-primary/5 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-300"><span aria-hidden>🔒</span> Los precios y el total en pesos se ven al iniciar sesión con Google. Es gratis y no pide tarjeta.</p>
            <button type="button" onClick={login}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-gray-900 font-semibold text-sm border border-fg-500/20 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-accent-primary">
              <GoogleLogo /> Ver precios con Google
            </button>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-semibold text-fg-300">¿No sabés por dónde empezar? Elegí una base y después sumá o sacá lo que quieras.</p>
          <div className="flex flex-wrap gap-2">
            {RECETAS.map(p => (
              <button key={p.label} type="button" onClick={() => usarPunto(p.ids)}
                className="px-3.5 py-2 rounded-full border border-fg-500/30 text-sm text-fg-200 hover:border-accent-primary hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-accent-primary transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preciosError && <p role="alert" className="text-red-600 dark:text-red-400">{preciosError}</p>}

        {catalogo.map(cat => {
          const abierta = abiertas.has(cat.category);
          const cuantos = cat.items.filter(i => todosIds.includes(i.id)).length;
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
                    const on = todosIds.includes(s.id);
                    const por = agregados[s.id] && !elegidos.has(s.id) ? mapa.get(agregados[s.id])?.label : null;
                    const p = precioDe(s);
                    return (
                      <li key={s.id}>
                        <div className={`flex gap-4 px-5 py-4 transition-colors ${on ? 'bg-accent-primary/5' : 'hover:bg-card-2'}`}>
                          <input id={`s-${s.id}`} type="checkbox" checked={on} disabled={!!por} onChange={() => toggle(s.id)}
                            className="mt-1 h-4 w-4 shrink-0 accent-[#4c01f9] cursor-pointer disabled:cursor-not-allowed" />
                          <div className="min-w-0 flex-1">
                            <label htmlFor={`s-${s.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 cursor-pointer">
                              <span className="font-medium text-fg">{s.label}</span>
                              {p != null ? (
                                <span className="font-mono text-sm text-fg-300 tabular-nums">{usd(p)}{s.porUnidad && cant(s) > 1 ? <span className="text-fg-500"> ({cant(s)}×)</span> : null}</span>
                              ) : cargandoPrecios ? (
                                <span className="font-mono text-xs text-fg-500">…</span>
                              ) : (
                                <button type="button" onClick={(e) => { e.preventDefault(); login(); }}
                                  className="font-mono text-xs text-fg-500 hover:text-accent-primary underline decoration-dotted underline-offset-2">🔒 Ver precio</button>
                              )}
                            </label>
                            <span className="block text-sm text-fg-500">{s.desc}</span>
                            {por && <span className="block mt-1 text-xs text-accent-primary">Se suma porque lo necesita: {por}</span>}
                            {on && s.benefit && <span className="block mt-1.5 text-sm text-fg-400">{s.benefit}</span>}
                            {on && s.porUnidad && (
                              <span className="mt-2 inline-flex items-center gap-2 text-sm text-fg-300">
                                Cantidad
                                <button type="button" onClick={() => cambiarCantidad(s.id, -1)} aria-label="Una menos" className="h-7 w-7 rounded-md border border-fg-500/30 hover:border-accent-primary">−</button>
                                <span className="font-mono tabular-nums w-5 text-center">{cant(s)}</span>
                                <button type="button" onClick={() => cambiarCantidad(s.id, 1)} aria-label="Una más" className="h-7 w-7 rounded-md border border-fg-500/30 hover:border-accent-primary">+</button>
                              </span>
                            )}
                          </div>
                        </div>
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
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg-500">{lista.length} pieza{lista.length === 1 ? '' : 's'}</span>
          </div>
          {lista.length === 0 ? (
            <p className="mt-4 text-sm text-fg-500">Marcá las piezas que necesitás y acá se arma tu proyecto.</p>
          ) : (
            <ul className="mt-4 space-y-2 font-mono text-[13px] tabular-nums">
              {lista.map(i => (
                <li key={i.id} className="flex items-baseline gap-2 text-fg-300">
                  {agregados[i.id] && !elegidos.has(i.id)
                    ? <span className="text-fg-500" title="Se suma solo" aria-hidden>↳</span>
                    : <button type="button" onClick={() => toggle(i.id)} aria-label={`Sacar ${i.label}`} className="text-fg-500 hover:text-red-500">×</button>}
                  <span className="min-w-0 truncate font-sans text-sm">{i.label}{i.porUnidad && cant(i) > 1 ? ` ×${cant(i)}` : ''}</span>
                  <span className="border-b border-dotted border-fg-500/40 flex-1 min-w-3 translate-y-[-3px]" aria-hidden />
                  <span>{precioDe(i) != null ? usd(precioDe(i)) : '—'}</span>
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

        {!user ? (
          <div className="px-5 pt-3 pb-5 space-y-3 text-center">
            <p className="text-sm text-fg-300">Iniciá sesión con Google para ver el total en pesos y pagar la seña o pedir presupuesto.</p>
            <button type="button" onClick={login} disabled={!authListo}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-gray-900 font-semibold py-3 border border-fg-500/20 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary disabled:opacity-50">
              <GoogleLogo /> Continuar con Google
            </button>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        ) : (
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
                  {!cot && datos && <p className="text-[11px] text-amber-600">Sin cotización del dólar ahora: probá en unos minutos o pedí presupuesto.</p>}
                </div>
              )}
            </dl>

            <div className="grid gap-2.5">
              <input required placeholder="Tu nombre" autoComplete="name" value={cliente.nombre} onChange={e => setCliente({ ...cliente, nombre: e.target.value })} className={inputCls} />
              <input required type="email" placeholder="Email" autoComplete="email" value={cliente.email} onChange={e => setCliente({ ...cliente, email: e.target.value })} className={inputCls} />
              <div className="grid grid-cols-2 gap-2.5">
                <input placeholder="WhatsApp" autoComplete="tel" value={cliente.telefono} onChange={e => setCliente({ ...cliente, telefono: e.target.value })} className={`${inputCls} min-w-0`} />
                <input placeholder="Negocio" autoComplete="organization" value={cliente.empresa} onChange={e => setCliente({ ...cliente, empresa: e.target.value })} className={`${inputCls} min-w-0`} />
              </div>
              <textarea rows={2} placeholder="Contame en dos líneas qué necesitás (opcional)" value={cliente.notas} onChange={e => setCliente({ ...cliente, notas: e.target.value })} className={inputCls} />
              <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={trampa} onChange={e => setTrampa(e.target.value)} name="website" />
            </div>

            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button type="submit" disabled={enviando || !datos || (modo !== 'presupuesto' && !cot)}
              className="w-full rounded-xl bg-accent-primary text-white font-semibold py-3 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary disabled:opacity-50">
              {enviando ? (modo === 'presupuesto' ? 'Enviando…' : 'Abriendo MercadoPago…')
                : modo === 'presupuesto' ? 'Pedir presupuesto' : 'Pagar con MercadoPago'}
            </button>
            <p className="text-[11px] leading-relaxed text-fg-500">
              Precios en dólares, cobrados en pesos al dólar oficial del día. El hosting en Vercel y Cloudinary tiene plan gratis para la mayoría de los negocios; si tu sitio lo supera, te aviso antes.
            </p>
          </div>
        )}
      </form>

      {/* Barra del celular: piezas y salto a la orden */}
      {lista.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur border-t border-fg-500/20 px-4 py-3 flex items-center justify-between gap-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="font-mono text-sm tabular-nums text-fg">{lista.length} pieza{lista.length === 1 ? '' : 's'}{datos ? ` · ${usd(total)}` : ''}</span>
          <a href="#orden" className="rounded-lg bg-accent-primary text-white text-sm font-semibold px-4 py-2">Ver mi orden</a>
        </div>
      )}
    </div>
  );
}
