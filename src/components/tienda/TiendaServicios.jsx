'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/track';
import { resolverDependencias } from '@/lib/tiendaDeps';
import { agruparPorObjetivo } from '@/lib/tiendaGrupos';
import { explicacionAlMarcar } from '@/lib/tiendaExplicacion';
import ListaServicios from './ListaServicios';
import Asistente from './Asistente';
import SolicitudForm from './SolicitudForm';
import { useSesionTienda } from './useSesionTienda';
import { useChatVivo } from '@/components/chatVivo/useChatVivo';

// Tienda por consulta (2026-11-25): el cliente marca servicios explicados en criollo; el asistente de la derecha
// explica cada cosa al instante (sin IA) y responde preguntas (IA, /api/tienda/asistente/); pide presupuesto con
// Meet opcional (/api/tienda/). NO hay precios en ningún lado: se charlan con Mariano.
// Firebase se carga recién después de hidratar para no ensuciar el LCP.

let seq = 0;
const msg = (rol, texto, extra = {}) => ({ id: `m${++seq}`, rol, texto, ...extra });
const SALUDO = 'Hola 👋 Soy el asistente de Mariano. Marcá a la izquierda lo que te interese y te explico para qué sirve. Si no sabés por dónde arrancar, contame a qué se dedica tu negocio.';
const SUGERENCIAS = ['Tengo un local y quiero vender online', '¿Cómo es el proceso?', '¿Cuánto tarda una web?'];

// encabezado: título de la página; va arriba de la lista para que en la compu el asistente arranque arriba de todo.
export default function TiendaServicios({ catalogo = [], encabezado = null }) {
  const items = useMemo(() => catalogo.flatMap(c => c.items), [catalogo]);
  const mapa = useMemo(() => new Map(items.map(s => [s.id, s])), [items]);
  const grupos = useMemo(() => agruparPorObjetivo(items), [items]);

  const authRef = useRef(null);
  const [user, setUser] = useState(null);
  const [authListo, setAuthListo] = useState(false);
  const [elegidos, setElegidos] = useState(() => new Set());
  const [mensajes, setMensajes] = useState(() => [msg('asistente', SALUDO)]);
  const [sugerencias, setSugerencias] = useState(SUGERENCIAS);
  const [escribiendo, setEscribiendo] = useState(false);
  const [ultimaPregunta, setUltimaPregunta] = useState('');
  const [hojaAbierta, setHojaAbierta] = useState(false); // celular: asistente como hoja
  const [nuevos, setNuevos] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(null);

  const { ids, agregados } = useMemo(() => resolverDependencias([...elegidos], items), [elegidos, items]);
  const marcados = useMemo(() => new Set(ids), [ids]);
  const pedido = ids.map(id => mapa.get(id)).filter(Boolean);
  const agregadosPor = useMemo(() => Object.fromEntries(Object.entries(agregados)
    .filter(([id]) => !elegidos.has(id)).map(([id, por]) => [id, mapa.get(por)?.label || por])), [agregados, elegidos, mapa]);
  const sesionId = useSesionTienda({ servicios: ids, ultimaPregunta });

  const decir = useCallback((texto, extra) => {
    setMensajes(m => [...m, msg('asistente', texto, extra)]);
    setNuevos(n => n + 1);
  }, []);

  // Chat en vivo: la charla queda en chats_vivo/tienda_<visita>; si Mariano entra (link de Telegram) y escribe,
  // sus mensajes aparecen acá.
  const chatId = sesionId ? `tienda_${sesionId}` : null;
  const [chatActivo, setChatActivo] = useState(false);
  const avisoHumano = useRef(false);
  const { avisarActividad } = useChatVivo({ chatId, activo: chatActivo, onMensaje: (t) => decir(`**Mariano:** ${t}`) });

  // ?servicios=a,b (links viejos / del chat) y ?presupuesto=1 (redirect de /presupuesto).
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const pre = (qs.get('servicios') || '').split(',').map(s => s.trim()).filter(id => mapa.has(id)).slice(0, 30);
    if (pre.length) setElegidos(new Set(pre));
    if (qs.get('presupuesto')) decir('Para pedir tu presupuesto, marcá lo que necesitás (aunque sea lo más parecido) y tocá **Pedir presupuesto**. Si tenés dudas, preguntame.');
    track('ver_tienda', {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Celular: la barra inferior sube los botones flotantes (ver globals.css, body[data-barra-inferior]).
  useEffect(() => {
    document.body.toggleAttribute('data-barra-inferior', true);
    return () => document.body.removeAttribute('data-barra-inferior');
  }, []);

  const sumar = (id, { explicar = true } = {}) => {
    if (!mapa.has(id) || marcados.has(id)) return;
    const antes = new Set(ids);
    const nuevo = new Set(elegidos).add(id);
    setElegidos(nuevo);
    track('add_to_cart', { item_id: id });
    if (!explicar) return;
    const r = resolverDependencias([...nuevo], items);
    const extras = r.ids.filter(x => x !== id && !antes.has(x)).map(x => mapa.get(x)).filter(Boolean);
    decir(explicacionAlMarcar(mapa.get(id)) + (extras.length ? `\nPara que funcione sumé también: ${extras.map(e => `**${e.label}**`).join(', ')}.` : ''));
  };
  const sacar = (id) => setElegidos(prev => { const n = new Set(prev); n.delete(id); return n; });
  const toggle = (id) => (elegidos.has(id) ? sacar(id) : sumar(id));

  const preguntar = (s) => {
    decir(explicacionAlMarcar(s, { agregadoPor: agregadosPor[s.id] || null }) + (s.ficha?.tiempo ? `\nTiempo: ${s.ficha.tiempo}` : ''));
    setSugerencias((s.ficha?.faq || []).map(f => f.q).slice(0, 3));
  };

  const receta = (r) => {
    const validos = r.ids.filter(id => mapa.has(id));
    setElegidos(new Set(validos));
    decir(`Te armé un punto de partida para **${r.label}**: ${validos.length} servicios. Sacá o sumá lo que quieras y preguntame lo que no entiendas.`);
  };

  const historial = () => mensajes.filter(m => !m.local).slice(-10).map(m => ({ rol: m.rol, texto: m.texto }));

  const enviarAsistente = async (texto) => {
    setMensajes(m => [...m, msg('cliente', texto)]);
    setUltimaPregunta(texto);
    setSugerencias([]);
    setEscribiendo(true);
    try {
      const token = await authRef.current?.getCurrentUser?.()?.getIdToken?.().catch(() => null);
      const res = await fetch('/api/tienda/asistente/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mensaje: texto, historial: historial(), marcados: ids, chatId }),
      });
      setChatActivo(true);
      avisarActividad();
      const d = await res.json().catch(() => ({}));
      if (d.humano) {
        // Mariano tomó el control: contesta él (llega por useChatVivo).
        if (!avisoHumano.current) { avisoHumano.current = true; decir('Te está leyendo Mariano en persona, ya te contesta por acá 🙂'); }
        return;
      }
      for (const a of d.acciones || []) (a.accion === 'sumar' ? sumar(a.id, { explicar: false }) : sacar(a.id));
      decir(d.respuesta || 'No te entendí bien, ¿me lo decís de otra forma?');
    } catch {
      decir('No pude responderte ahora. Probá de nuevo en un ratito o escribile a Mariano por WhatsApp.');
    } finally {
      setEscribiendo(false);
    }
  };

  const login = async () => {
    setError('');
    try { await authRef.current?.loginWithGoogle(); } catch { setError('No se pudo entrar con Google. Probá de nuevo.'); }
  };

  const abrirForm = () => { setFormAbierto(true); setHojaAbierta(false); track('abrir_solicitud', { items: ids.length }); };

  const enviarSolicitud = async ({ cliente, meet, website }) => {
    setError('');
    setEnviando(true);
    try {
      const token = await authRef.current?.getCurrentUser()?.getIdToken();
      const res = await fetch('/api/tienda/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ servicios: [...elegidos], cliente, meet, website, sesionId, chat: historial().slice(1) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar el pedido');
      track('solicitud_presupuesto', { items: ids.length });
      if (meet) track('meet_pedido', {});
      setListo({ id: d.id, conMeet: !!meet, email: cliente.email });
      setFormAbierto(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <p className="font-[family-name:var(--font-ia-mono)] text-xs uppercase tracking-[0.2em] text-fg-500">Pedido #{String(listo.id).slice(0, 6)}</p>
        <h2 className="mt-3 font-[family-name:var(--font-ia-display)] text-3xl font-bold text-fg">¡Listo! Ya me llegó tu pedido</h2>
        <p className="mt-3 text-fg-400">
          Te escribo en menos de 24 h{listo.email ? ` a ${listo.email}` : ''}.
          {listo.conMeet ? ' Cuando confirme el horario te llega la invitación al Meet por mail.' : ''}
        </p>
      </div>
    );
  }

  const asistente = (
    <Asistente mensajes={mensajes} escribiendo={escribiendo} onEnviar={enviarAsistente} pedido={pedido} onPedir={abrirForm}
      sugerencias={sugerencias} onSugerencia={enviarAsistente} />
  );

  return (
    // Compu: scrollea toda la página y el chat queda flotando a la derecha, entero dentro de la pantalla (arranca
    // a la altura del título porque el encabezado va en la columna izquierda). Pedido de Mariano 2026-11-26.
    <div className="max-w-7xl mx-auto px-4 pb-28 lg:pb-16 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
      <div className="min-w-0">
        {encabezado}
        <ListaServicios grupos={grupos} marcados={marcados} agregadosPor={agregadosPor} onToggle={toggle} onPreguntar={(s) => { preguntar(s); setHojaAbierta(true); }} onReceta={receta} />
      </div>

      {/* Escritorio: asistente fijo al costado */}
      <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100dvh-7rem)]">{asistente}</aside>

      {/* Celular: barra inferior + asistente como hoja */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur border-t border-fg/10 px-4 py-3 flex items-center gap-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => { setHojaAbierta(true); setNuevos(0); }}
          className="relative flex-1 rounded-xl border border-fg/15 text-fg text-sm font-semibold py-2.5">
          💬 Asistente
          {nuevos > 0 && !hojaAbierta && <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-accent-primary text-white text-[11px] grid place-items-center">{nuevos}</span>}
        </button>
        <button type="button" onClick={abrirForm} disabled={!pedido.length}
          className="flex-1 rounded-xl bg-accent-primary text-white text-sm font-semibold py-2.5 disabled:opacity-40">
          Pedir presupuesto ({pedido.length})
        </button>
      </div>
      {hojaAbierta && (
        <div className="lg:hidden fixed inset-0 z-[1050] bg-black/50" onClick={() => setHojaAbierta(false)}>
          <div className="absolute inset-x-0 bottom-0 h-[85dvh] p-2" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setHojaAbierta(false)} className="absolute right-4 -top-10 h-9 px-3 rounded-full bg-card text-fg text-sm border border-fg/15">Cerrar ✕</button>
            {asistente}
          </div>
        </div>
      )}

      {formAbierto && (
        <SolicitudForm pedido={pedido} user={user} authListo={authListo} onLogin={login} onEnviar={enviarSolicitud}
          onCerrar={() => setFormAbierto(false)} enviando={enviando} error={error} />
      )}
    </div>
  );
}
