'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { exportarPedidoExcel } from './exportPedido';

const DRAFT_KEY = 'mf_pedido_borrador';

const pesos = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }));

// Inserta una transformación de Cloudinary (ancho + formato automático) en la URL.
const cld = (url, w) => (url ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`) : null);

const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const keyRenglon = (r) => `${r.productId}|${r.talle}|${r.color}`;

function leerBorrador() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}

export default function CatalogoProveedor() {
  const { user, getIdToken } = useAuthUser();
  const [estado, setEstado] = useState('cargando'); // cargando | ok | sin_acceso | error
  const [productos, setProductos] = useState([]);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [coleccion, setColeccion] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);
  // Borrador del pedido en este navegador, para no perderlo si se cierra la pestaña.
  // (Este componente solo se monta en el cliente, detrás de AuthGate.)
  const [borrador] = useState(leerBorrador);
  const [renglones, setRenglones] = useState(borrador?.renglones || []);
  const [pedidoId, setPedidoId] = useState(borrador?.pedidoId || null);
  const [nombre, setNombre] = useState(borrador?.nombre || '');
  const [pedidos, setPedidos] = useState([]);
  const [verPedidoMovil, setVerPedidoMovil] = useState(false);
  const [aviso, setAviso] = useState('');

  const api = useCallback(async (path, opts = {}) => {
    const token = await getIdToken();
    const res = await fetch(path, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
    return data;
  }, [getIdToken]);

  const cargarPedidos = useCallback(() => api('/api/proveedor/pedidos/').then((d) => setPedidos(d.pedidos)).catch(() => {}), [api]);

  useEffect(() => {
    api('/api/proveedor/catalogo/')
      .then((d) => {
        setProductos(d.productos);
        setUltimaSync(d.ultimaSync);
        setEstado('ok');
        cargarPedidos();
      })
      .catch((e) => setEstado(e.status === 403 ? 'sin_acceso' : 'error'));
  }, [api, cargarPedidos]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ renglones, nombre, pedidoId }));
    } catch {}
  }, [renglones, nombre, pedidoId]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const items = useMemo(() => productos.filter((p) => p.tipo === 'producto'), [productos]);
  const infos = useMemo(() => productos.filter((p) => p.tipo === 'info'), [productos]);
  const colecciones = useMemo(() => {
    const cuenta = new Map();
    items.forEach((p) => p.colecciones.forEach((c) => cuenta.set(c, (cuenta.get(c) || 0) + 1)));
    return [...cuenta.entries()];
  }, [items]);

  const cambiosSync = useMemo(() => {
    const nuevos = new Set((ultimaSync?.nuevos || []).map((x) => x.id));
    const cambiados = new Map((ultimaSync?.cambiados || []).map((x) => [x.id, x]));
    return { nuevos, cambiados };
  }, [ultimaSync]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((p) =>
      (coleccion === 'Todas' || p.colecciones.includes(coleccion)) &&
      (!q || `${p.codigo || ''} ${p.titulo} ${p.descripcion}`.toLowerCase().includes(q)));
  }, [items, coleccion, busqueda]);

  const total = renglones.reduce((s, r) => s + r.cantidad * r.precioMayor, 0);
  const unidades = renglones.reduce((s, r) => s + r.cantidad, 0);

  function agregar(nuevos) {
    setRenglones((prev) => {
      const map = new Map(prev.map((r) => [keyRenglon(r), r]));
      for (const r of nuevos) {
        const k = keyRenglon(r);
        const ya = map.get(k);
        map.set(k, ya ? { ...ya, cantidad: ya.cantidad + r.cantidad } : r);
      }
      return [...map.values()];
    });
    setAviso(`Agregado al pedido: ${nuevos.reduce((s, r) => s + r.cantidad, 0)} u.`);
  }

  function cambiarCantidad(k, cantidad) {
    setRenglones((prev) => prev
      .map((r) => (keyRenglon(r) === k ? { ...r, cantidad } : r))
      .filter((r) => r.cantidad > 0));
  }

  function nuevoPedido() {
    setRenglones([]);
    setNombre('');
    setPedidoId(null);
  }

  async function guardar() {
    try {
      const { id } = await api('/api/proveedor/pedidos/', {
        method: 'POST',
        body: JSON.stringify({ id: pedidoId, nombre, renglones }),
      });
      setPedidoId(id);
      setAviso('Pedido guardado');
      cargarPedidos();
    } catch (e) {
      setAviso(`No se pudo guardar: ${e.message}`);
    }
  }

  async function borrarPedido(id) {
    if (!window.confirm('¿Borrar este pedido guardado?')) return;
    await api(`/api/proveedor/pedidos/?id=${id}`, { method: 'DELETE' }).catch(() => {});
    if (id === pedidoId) setPedidoId(null);
    cargarPedidos();
  }

  function abrirPedido(p) {
    setRenglones(p.renglones);
    setNombre(p.nombre || '');
    setPedidoId(p.id);
    setVerPedidoMovil(true);
  }

  if (estado === 'cargando') {
    return <div className="mf-root mf-centro"><Estilos /><p className="mf-mono">Cargando catálogo…</p></div>;
  }
  if (estado === 'sin_acceso') {
    return (
      <div className="mf-root mf-centro"><Estilos />
        <h1 className="mf-display mf-h1">Sección privada</h1>
        <p>Entraste como <b>{user?.email}</b>, que no tiene acceso a este catálogo. Pedile a Mariano que te habilite.</p>
      </div>
    );
  }
  if (estado === 'error') {
    return <div className="mf-root mf-centro"><Estilos /><p>No se pudo cargar el catálogo. Recargá la página para reintentar.</p></div>;
  }

  return (
    <div className="mf-root">
      <Estilos />
      <header className="mf-header">
        <div>
          <p className="mf-eyebrow">Catálogo mayorista · copia propia</p>
          <h1 className="mf-display mf-h1">Mood Fit</h1>
        </div>
        <div className="mf-sync">
          {ultimaSync ? (
            <>
              <span className="mf-mono">Actualizado {fechaCorta(ultimaSync.fecha)}</span>
              <span className="mf-sync-chips">
                {ultimaSync.nuevos?.length > 0 && <span className="mf-chip mf-chip-nuevo">{ultimaSync.nuevos.length} nuevos</span>}
                {ultimaSync.cambiados?.length > 0 && <span className="mf-chip mf-chip-cambio">{ultimaSync.cambiados.length} cambiaron de precio</span>}
                {ultimaSync.desaparecidos?.length > 0 && <span className="mf-chip">{ultimaSync.desaparecidos.length} ya no están</span>}
              </span>
            </>
          ) : <span className="mf-mono">Sin sincronizar</span>}
        </div>
      </header>

      <div className="mf-layout">
        <main>
          <div className="mf-toolbar">
            <input
              className="mf-input mf-buscar"
              type="search"
              placeholder="Buscar por código o nombre"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar productos"
            />
            <div className="mf-colecciones" role="tablist" aria-label="Colecciones">
              {[['Todas', items.length], ...colecciones].map(([c, n]) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={coleccion === c}
                  className={`mf-col ${coleccion === c ? 'is-on' : ''}`}
                  onClick={() => setColeccion(c)}
                >
                  {c} <span className="mf-mono">{n}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mf-conteo mf-mono">{visibles.length} productos</p>
          <div className="mf-grid">
            {visibles.map((p) => (
              <Card
                key={p.id}
                p={p}
                nuevo={cambiosSync.nuevos.has(p.id)}
                cambio={cambiosSync.cambiados.get(p.id)}
                onOpen={() => setAbierto(p)}
              />
            ))}
            {!visibles.length && <p className="mf-vacio">Ningún producto coincide con “{busqueda}”. Probá con el código.</p>}
          </div>

          {infos.length > 0 && (
            <details className="mf-info">
              <summary className="mf-display">Información del vendedor ({infos.length})</summary>
              <div className="mf-info-grid">
                {infos.map((p) => (
                  <figure key={p.id}>
                    {p.imagenes?.[0]?.url && <a href={p.imagenes[0].url} target="_blank" rel="noreferrer"><img src={cld(p.imagenes[0].url, 500)} alt={p.titulo} loading="lazy" /></a>}
                    <figcaption><b>{p.titulo}</b><br />{p.descripcion}</figcaption>
                  </figure>
                ))}
              </div>
            </details>
          )}
        </main>

        <aside className={`mf-remito-wrap ${verPedidoMovil ? 'is-open' : ''}`}>
          <Remito
            renglones={renglones}
            total={total}
            unidades={unidades}
            nombre={nombre}
            setNombre={setNombre}
            pedidoId={pedidoId}
            onCantidad={cambiarCantidad}
            onGuardar={guardar}
            onExportar={() => exportarPedidoExcel(renglones, nombre)}
            onNuevo={nuevoPedido}
            onCerrar={() => setVerPedidoMovil(false)}
            pedidos={pedidos}
            onAbrirPedido={abrirPedido}
            onBorrarPedido={borrarPedido}
          />
        </aside>
      </div>

      <button className="mf-barra-movil" onClick={() => setVerPedidoMovil(true)}>
        <span>Pedido · {unidades} u.</span>
        <span className="mf-mono">{pesos(total)}</span>
      </button>

      {abierto && <Ficha p={abierto} onClose={() => setAbierto(null)} onAgregar={(rs) => { agregar(rs); setAbierto(null); }} />}
      {aviso && <div className="mf-aviso" role="status">{aviso}</div>}
    </div>
  );
}

function Etiqueta({ mayor, sugerido, grande }) {
  return (
    <div className={`mf-tag ${grande ? 'mf-tag-lg' : ''}`}>
      <span className="mf-tag-hole" aria-hidden />
      <span className="mf-tag-label">Por mayor</span>
      <span className="mf-tag-precio mf-display">{pesos(mayor)}</span>
      {sugerido != null && (
        <span className="mf-tag-sug">Sugerido venta <b className="mf-mono">{pesos(sugerido)}</b></span>
      )}
    </div>
  );
}

function Card({ p, nuevo, cambio, onOpen }) {
  const img = p.imagenes?.[0]?.url;
  return (
    <button className="mf-card" onClick={onOpen}>
      <div className="mf-card-img">
        {img ? <img src={cld(img, 480)} alt="" loading="lazy" /> : <span className="mf-sinfoto">Sin foto</span>}
        {nuevo && <span className="mf-chip mf-chip-nuevo mf-card-badge">Nuevo</span>}
        {cambio && !nuevo && (
          <span className="mf-chip mf-chip-cambio mf-card-badge" title={`Antes ${pesos(cambio.antes)}`}>
            {cambio.despues > cambio.antes ? '▲' : '▼'} Antes {pesos(cambio.antes)}
          </span>
        )}
        <Etiqueta mayor={p.precioMayor} sugerido={p.precioSugerido} />
      </div>
      <div className="mf-card-body">
        {p.codigo && <span className="mf-codigo mf-mono">{p.codigo}</span>}
        <span className="mf-card-titulo">{p.codigo ? p.titulo.replace(p.codigo, '').replace(/\$[\d.,]+\s*por mayor/i, '').trim() : p.titulo}</span>
        {p.talles?.length > 0 && <span className="mf-talles-mini mf-mono">{p.talles.join(' · ')}</span>}
      </div>
    </button>
  );
}

function Ficha({ p, onClose, onAgregar }) {
  const [cant, setCant] = useState({}); // talle → cantidad
  const [talleLibre, setTalleLibre] = useState('');
  const [cantLibre, setCantLibre] = useState(1);
  const [color, setColor] = useState('');
  const conTalles = p.talles?.length > 0;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const base = { productId: p.id, codigo: p.codigo, titulo: p.titulo, color: color.trim(), precioMayor: p.precioMayor, precioSugerido: p.precioSugerido };
  const elegidos = conTalles
    ? Object.entries(cant).filter(([, n]) => n > 0).map(([talle, n]) => ({ ...base, talle, cantidad: n }))
    : cantLibre > 0 ? [{ ...base, talle: talleLibre.trim(), cantidad: cantLibre }] : [];
  const totalFicha = elegidos.reduce((s, r) => s + r.cantidad * r.precioMayor, 0);

  const toggle = (t) => setCant((c) => ({ ...c, [t]: c[t] > 0 ? 0 : 1 }));
  const step = (t, d) => setCant((c) => ({ ...c, [t]: Math.max(0, (c[t] || 0) + d) }));

  return (
    <div className="mf-modal" role="dialog" aria-modal="true" aria-label={p.titulo} onClick={onClose}>
      <div className="mf-ficha" onClick={(e) => e.stopPropagation()}>
        <button className="mf-cerrar" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="mf-ficha-img">
          {p.imagenes?.[0]?.url && <img src={cld(p.imagenes[0].url, 900)} alt={p.titulo} />}
        </div>
        <div className="mf-ficha-body">
          {p.codigo && <span className="mf-codigo mf-mono">{p.codigo}</span>}
          <h2 className="mf-display mf-h2">{p.titulo}</h2>
          <Etiqueta mayor={p.precioMayor} sugerido={p.precioSugerido} grande />
          <p className="mf-desc">{p.descripcion}</p>

          <fieldset className="mf-fs">
            <legend>Talles</legend>
            {conTalles ? (
              <div className="mf-talles">
                {p.talles.map((t) => {
                  const n = cant[t] || 0;
                  return (
                    <div key={t} className={`mf-talle ${n > 0 ? 'is-on' : ''}`}>
                      <button type="button" className="mf-talle-btn" onClick={() => toggle(t)} aria-pressed={n > 0}>{t}</button>
                      {n > 0 && (
                        <span className="mf-stepper">
                          <button type="button" onClick={() => step(t, -1)} aria-label={`Una menos talle ${t}`}>−</button>
                          <input
                            className="mf-mono"
                            inputMode="numeric"
                            value={n}
                            onChange={(e) => setCant((c) => ({ ...c, [t]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                            aria-label={`Cantidad talle ${t}`}
                          />
                          <button type="button" onClick={() => step(t, 1)} aria-label={`Una más talle ${t}`}>+</button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mf-libre">
                <input className="mf-input" placeholder="Talle (opcional)" value={talleLibre} onChange={(e) => setTalleLibre(e.target.value)} />
                <input className="mf-input mf-mono" inputMode="numeric" value={cantLibre} onChange={(e) => setCantLibre(Math.max(0, parseInt(e.target.value, 10) || 0))} aria-label="Cantidad" />
              </div>
            )}
          </fieldset>

          <label className="mf-fs">
            <span className="mf-legend">Color (opcional)</span>
            <input className="mf-input" placeholder="Ej. negro" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>

          <button className="mf-primario" disabled={!elegidos.length} onClick={() => onAgregar(elegidos)}>
            {elegidos.length
              ? `Agregar ${elegidos.reduce((s, r) => s + r.cantidad, 0)} u. al pedido · ${pesos(totalFicha)}`
              : conTalles ? 'Elegí al menos un talle' : 'Indicá la cantidad'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Remito({ renglones, total, unidades, nombre, setNombre, pedidoId, onCantidad, onGuardar, onExportar, onNuevo, onCerrar, pedidos, onAbrirPedido, onBorrarPedido }) {
  return (
    <div className="mf-remito">
      <div className="mf-remito-head">
        <span className="mf-display mf-h3">Pedido</span>
        <span className="mf-mono mf-muted">{pedidoId ? 'guardado' : 'sin guardar'}</span>
        <button className="mf-remito-cerrar" onClick={onCerrar} aria-label="Cerrar pedido">×</button>
      </div>
      <input className="mf-input" placeholder="Nombre del pedido (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />

      {renglones.length === 0 ? (
        <p className="mf-vacio">Tocá un producto, elegí talles y agregalos acá.</p>
      ) : (
        <ol className="mf-lineas">
          {renglones.map((r) => {
            const k = keyRenglon(r);
            return (
              <li key={k}>
                <div className="mf-linea-top">
                  <span className="mf-mono mf-linea-cod">{r.codigo || '—'}</span>
                  <span className="mf-linea-tit">{r.titulo}</span>
                </div>
                <div className="mf-linea-bot mf-mono">
                  <span>T {r.talle || '—'}{r.color ? ` · ${r.color}` : ''}</span>
                  <span className="mf-stepper mf-stepper-sm">
                    <button onClick={() => onCantidad(k, r.cantidad - 1)} aria-label="Una menos">−</button>
                    <span>{r.cantidad}</span>
                    <button onClick={() => onCantidad(k, r.cantidad + 1)} aria-label="Una más">+</button>
                  </span>
                  <span>× {pesos(r.precioMayor)}</span>
                  <b>{pesos(r.cantidad * r.precioMayor)}</b>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mf-total">
        <span>Total · {unidades} u.</span>
        <span className="mf-display">{pesos(total)}</span>
      </div>
      <div className="mf-acciones">
        <button className="mf-primario" disabled={!renglones.length} onClick={onExportar}>Exportar a Excel</button>
        <button className="mf-secundario" disabled={!renglones.length} onClick={onGuardar}>Guardar pedido</button>
        <button className="mf-link" disabled={!renglones.length} onClick={onNuevo}>Empezar uno nuevo</button>
      </div>

      {pedidos.length > 0 && (
        <div className="mf-guardados">
          <p className="mf-eyebrow">Pedidos guardados</p>
          <ul>
            {pedidos.map((p) => (
              <li key={p.id} className={p.id === pedidoId ? 'is-on' : ''}>
                <button className="mf-guardado" onClick={() => onAbrirPedido(p)}>
                  <span>{p.nombre || fechaCorta(p.actualizadoEn)}</span>
                  <span className="mf-mono mf-muted">{p.unidades} u. · {pesos(p.total)}</span>
                </button>
                <button className="mf-link" onClick={() => onBorrarPedido(p.id)} aria-label="Borrar pedido">Borrar</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Estilos() {
  return (
    <style>{`
.mf-root{--paper:#EEF0F4;--card:#FFFFFF;--ink:#16181D;--muted:#6A7080;--line:#D9DCE3;--mag:#C8175D;--mag-ink:#FFFFFF;--kraft:#DCC79E;--kraft-ink:#2B2416;--ok:#127A4A;--warn:#B4530A;
  background:var(--paper);color:var(--ink);font-family:var(--mf-body),system-ui,sans-serif;min-height:100vh;padding:24px 16px 96px}
:root.dark .mf-root, .dark .mf-root, .sh-force-dark .mf-root{--paper:#111318;--card:#1A1D24;--ink:#ECEEF2;--muted:#9AA1AF;--line:#2A2E37;--mag:#F0498A;--kraft:#C9B38A;--kraft-ink:#211B10;--ok:#4ACB8B;--warn:#F59E52}
.mf-root *{box-sizing:border-box}
.mf-display{font-family:var(--mf-display),sans-serif;letter-spacing:.01em}
.mf-mono{font-family:var(--mf-mono),ui-monospace,monospace}
.mf-muted{color:var(--muted)}
.mf-centro{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px}
.mf-h1{font-size:clamp(48px,9vw,96px);font-weight:800;line-height:.85;text-transform:uppercase;margin:0;color:var(--mag)}
.mf-h2{font-size:30px;font-weight:800;line-height:1;text-transform:uppercase;margin:6px 0 14px}
.mf-h3{font-size:26px;font-weight:800;text-transform:uppercase}
.mf-eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
.mf-header{max-width:1400px;margin:0 auto 20px;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;border-bottom:2px solid var(--ink);padding-bottom:14px}
.mf-sync{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:13px}
.mf-sync-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.mf-chip{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:var(--line);color:var(--ink);white-space:nowrap}
.mf-chip-nuevo{background:var(--mag);color:var(--mag-ink)}
.mf-chip-cambio{background:var(--warn);color:#fff}
.mf-layout{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
@media(min-width:1024px){.mf-layout{grid-template-columns:minmax(0,1fr) 380px}}
.mf-toolbar{display:flex;flex-direction:column;gap:10px;position:sticky;top:0;z-index:5;background:var(--paper);padding:8px 0}
.mf-input{width:100%;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit;font-size:15px}
.mf-input:focus-visible,.mf-root button:focus-visible{outline:2px solid var(--mag);outline-offset:2px}
.mf-colecciones{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.mf-col{flex:none;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;white-space:nowrap}
.mf-col .mf-mono{color:var(--muted);font-size:11px;margin-left:4px}
.mf-col.is-on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.mf-col.is-on .mf-mono{color:inherit;opacity:.7}
.mf-conteo{font-size:12px;color:var(--muted);margin:6px 0 10px}
.mf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}
@media(min-width:640px){.mf-grid{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}}
.mf-card{all:unset;cursor:pointer;display:flex;flex-direction:column;background:var(--card);border-radius:10px;overflow:hidden;border:1px solid var(--line);transition:transform .15s ease,box-shadow .15s ease}
.mf-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.mf-card:focus-visible{outline:2px solid var(--mag);outline-offset:2px}
.mf-card-img{position:relative;aspect-ratio:1;background:#fff;overflow:hidden}
.mf-card-img img{width:100%;height:100%;object-fit:cover;display:block}
.mf-sinfoto{display:flex;height:100%;align-items:center;justify-content:center;color:var(--muted);font-size:12px}
.mf-card-badge{position:absolute;top:8px;left:8px}
.mf-card-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px}
.mf-codigo{font-size:11px;letter-spacing:.06em;color:var(--mag);font-weight:500}
.mf-card-titulo{font-size:13.5px;line-height:1.3;font-weight:500;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mf-talles-mini{font-size:11px;color:var(--muted)}
/* Etiqueta colgante (firma de la página) */
.mf-tag{position:absolute;right:8px;bottom:8px;background:var(--kraft);color:var(--kraft-ink);padding:8px 10px 7px 20px;display:flex;flex-direction:column;align-items:flex-start;line-height:1.05;
  clip-path:polygon(12px 0,100% 0,100% 100%,12px 100%,0 50%);transform:rotate(-3deg);transform-origin:right bottom;box-shadow:0 2px 6px rgba(0,0,0,.18);transition:transform .2s ease}
.mf-card:hover .mf-tag{transform:rotate(0deg)}
.mf-tag-hole{position:absolute;left:8px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--card);box-shadow:inset 0 1px 1px rgba(0,0,0,.35)}
.mf-tag-label{font-size:9px;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.mf-tag-precio{font-size:22px;font-weight:800}
.mf-tag-sug{font-size:10px;margin-top:2px;opacity:.85}
.mf-tag-sug b{font-weight:500}
.mf-tag-lg{position:relative;right:auto;bottom:auto;display:inline-flex;transform:rotate(-1.5deg);margin:2px 0 14px;padding:10px 16px 9px 26px}
.mf-tag-lg .mf-tag-precio{font-size:32px}
.mf-tag-lg .mf-tag-sug{font-size:12px}
.mf-vacio{color:var(--muted);font-size:14px;grid-column:1/-1;padding:16px 0}
.mf-info{margin-top:32px;border-top:1px solid var(--line);padding-top:12px}
.mf-info summary{font-size:22px;font-weight:800;text-transform:uppercase;cursor:pointer}
.mf-info-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:12px}
.mf-info figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px}
.mf-info img{width:100%;display:block}
.mf-info figcaption{padding:10px;white-space:pre-line}
/* Remito */
.mf-remito-wrap{display:none}
@media(min-width:1024px){.mf-remito-wrap{display:block;position:sticky;top:16px;align-self:start;max-height:calc(100vh - 32px);overflow:auto}}
.mf-remito-wrap.is-open{display:block;position:fixed;inset:0;z-index:60;background:var(--paper);overflow:auto;padding:16px}
@media(min-width:1024px){.mf-remito-wrap.is-open{position:sticky;inset:auto;padding:0;z-index:auto}}
.mf-remito{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px;
  background-image:repeating-linear-gradient(to bottom,transparent 0 27px,var(--line) 27px 28px);background-position:0 120px;background-repeat:no-repeat;background-size:100% 0}
.mf-remito-head{display:flex;align-items:baseline;gap:10px;border-bottom:2px dashed var(--line);padding-bottom:8px}
.mf-remito-head .mf-muted{font-size:11px;flex:1}
.mf-remito-cerrar{all:unset;cursor:pointer;font-size:26px;line-height:1;padding:0 4px}
@media(min-width:1024px){.mf-remito-cerrar{display:none}}
.mf-lineas{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.mf-lineas li{padding:9px 0;border-bottom:1px dashed var(--line)}
.mf-linea-top{display:flex;gap:8px;font-size:13px;line-height:1.3}
.mf-linea-cod{font-size:11px;color:var(--mag);flex:none;padding-top:1px}
.mf-linea-tit{overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.mf-linea-bot{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:center;font-size:12px;margin-top:6px;color:var(--muted)}
.mf-linea-bot b{color:var(--ink);font-weight:500;min-width:76px;text-align:right}
.mf-stepper{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--card)}
.mf-stepper button{all:unset;cursor:pointer;width:26px;height:26px;text-align:center;line-height:26px;color:var(--ink)}
.mf-stepper button:hover{background:var(--line)}
.mf-stepper input{width:38px;text-align:center;border:0;background:transparent;color:var(--ink);font-size:13px}
.mf-stepper-sm span{min-width:22px;text-align:center;color:var(--ink)}
.mf-stepper-sm button{width:22px;height:22px;line-height:22px}
.mf-total{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--ink);padding-top:10px;font-size:13px}
.mf-total .mf-display{font-size:30px;font-weight:800}
.mf-acciones{display:flex;flex-direction:column;gap:8px}
.mf-primario{all:unset;cursor:pointer;text-align:center;background:var(--mag);color:var(--mag-ink);font-weight:600;padding:12px 14px;border-radius:8px;font-size:15px}
.mf-primario:disabled{opacity:.4;cursor:not-allowed}
.mf-secundario{all:unset;cursor:pointer;text-align:center;border:1.5px solid var(--ink);padding:10px 14px;border-radius:8px;font-weight:600;font-size:14px}
.mf-secundario:disabled{opacity:.4;cursor:not-allowed}
.mf-link{all:unset;cursor:pointer;font-size:13px;color:var(--muted);text-decoration:underline;text-align:center}
.mf-link:disabled{opacity:.4;cursor:not-allowed}
.mf-guardados{border-top:1px solid var(--line);padding-top:12px}
.mf-guardados ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.mf-guardados li{display:flex;align-items:center;gap:8px;border-radius:6px;padding:4px 6px}
.mf-guardados li.is-on{background:var(--paper)}
.mf-guardado{all:unset;cursor:pointer;flex:1;display:flex;flex-direction:column;font-size:13px}
.mf-guardado .mf-mono{font-size:11px}
.mf-barra-movil{position:fixed;left:16px;right:16px;bottom:16px;z-index:50;display:flex;justify-content:space-between;align-items:center;background:var(--ink);color:var(--paper);border:0;border-radius:10px;padding:14px 16px;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}
@media(min-width:1024px){.mf-barra-movil{display:none}}
/* Ficha */
.mf-modal{position:fixed;inset:0;z-index:70;background:rgba(10,12,16,.6);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:768px){.mf-modal{align-items:center;padding:24px}}
.mf-ficha{position:relative;background:var(--card);color:var(--ink);width:100%;max-width:960px;max-height:92vh;overflow:auto;border-radius:14px 14px 0 0;display:grid;grid-template-columns:1fr}
@media(min-width:768px){.mf-ficha{grid-template-columns:1fr 1fr;border-radius:14px}}
.mf-ficha-img{background:#fff}
.mf-ficha-img img{width:100%;height:100%;object-fit:contain;display:block;max-height:70vh}
.mf-ficha-body{padding:20px;display:flex;flex-direction:column;gap:6px}
.mf-cerrar{all:unset;cursor:pointer;position:absolute;top:8px;right:12px;font-size:30px;line-height:1;z-index:2;color:var(--ink);background:var(--card);border-radius:50%;width:36px;height:36px;text-align:center}
.mf-desc{white-space:pre-line;font-size:14px;color:var(--muted);margin:0 0 8px}
.mf-fs{border:0;padding:0;margin:0 0 12px;display:flex;flex-direction:column;gap:8px}
.mf-fs legend,.mf-legend{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.mf-talles{display:flex;flex-wrap:wrap;gap:8px}
.mf-talle{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:8px;padding:3px}
.mf-talle.is-on{border-color:var(--mag)}
.mf-talle-btn{all:unset;cursor:pointer;min-width:38px;height:34px;line-height:34px;text-align:center;font-family:var(--mf-display),sans-serif;font-weight:800;font-size:18px;border-radius:6px;padding:0 6px}
.mf-talle.is-on .mf-talle-btn{background:var(--mag);color:var(--mag-ink)}
.mf-libre{display:grid;grid-template-columns:1fr 90px;gap:8px}
.mf-aviso{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:80;background:var(--ink);color:var(--paper);padding:10px 16px;border-radius:8px;font-size:14px}
@media(prefers-reduced-motion:reduce){.mf-card,.mf-tag{transition:none}.mf-card:hover{transform:none}}
`}</style>
  );
}
