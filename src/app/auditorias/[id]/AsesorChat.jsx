'use client';

import { useEffect, useRef, useState } from 'react';
import { SERVICIOS_OFERTA, WHATSAPP_MARIANO, whatsappUrl, mensajeDesdeInforme } from '@/lib/auditPitch';
import { track } from '@/lib/track';

// Chat de ventas al costado del informe privado (/api/auditorias/asesor/). El saludo llega armado
// del servidor (sin IA). Cuando el cliente se interesa, la IA abre el formulario de presupuesto y el
// pedido se manda desde acá mismo (/api/auditorias/solicitud/), sin salir de la pantalla.

const SUGERENCIAS = [
  '¿Qué le mejorarías a mi web?',
  '¿Qué es un agente o un RAG?',
  '¿Cómo sería conectarlo a ChatGPT o Claude?',
  'Quiero un presupuesto',
];

function Texto({ texto }) {
  return String(texto).split('\n').map((linea, i) => (
    <p key={i} className={i ? 'mt-1.5' : ''}>
      {linea.split(/(\*\*[^*]+\*\*)/g).map((t, j) => (t.startsWith('**') && t.endsWith('**') ? <strong key={j} className="font-semibold">{t.slice(2, -2)}</strong> : t))}
    </p>
  ));
}

let seq = 0;
const nuevoId = () => `m${Date.now()}_${seq++}`;

export default function AsesorChat({ auditoriaId, clave, negocioId, negocioNombre, saludo }) {
  const [mensajes, setMensajes] = useState([{ id: 'hola', rol: 'asistente', texto: saludo }]);
  const [texto, setTexto] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [form, setForm] = useState(null); // null | { servicios: Set }
  const [enviado, setEnviado] = useState(false);
  const fin = useRef(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [mensajes.length, escribiendo, form, enviado]);

  const abrirForm = (servicios = []) => setForm(f => ({ servicios: new Set([...(f?.servicios || []), ...servicios]) }));

  const enviar = async (t) => {
    const msg = String(t || '').trim();
    if (!msg || escribiendo) return;
    const historial = mensajes.map(m => ({ rol: m.rol, texto: m.texto }));
    setMensajes(ms => [...ms, { id: nuevoId(), rol: 'cliente', texto: msg }]);
    setTexto('');
    setEscribiendo(true);
    if (!historial.some(m => m.rol === 'cliente')) track('auditoria_chat', { auditoria_id: auditoriaId });
    try {
      const res = await fetch('/api/auditorias/asesor/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: auditoriaId, k: clave, para: negocioId, mensaje: msg, historial }),
      });
      const d = await res.json().catch(() => ({}));
      setMensajes(ms => [...ms, { id: nuevoId(), rol: 'asistente', texto: d.respuesta || 'No pude responderte ahora, probá de nuevo en un ratito.' }]);
      if (d.formulario) abrirForm(d.formulario.servicios);
    } catch {
      setMensajes(ms => [...ms, { id: nuevoId(), rol: 'asistente', texto: 'Se cortó la conexión. Probá de nuevo o escribile a Mariano por WhatsApp.' }]);
    } finally {
      setEscribiendo(false);
    }
  };

  const pedirForm = () => { abrirForm(); track('auditoria_form_abierto', { auditoria_id: auditoriaId }); };
  const onSugerencia = (s) => (s === 'Quiero un presupuesto' ? pedirForm() : enviar(s));

  return (
    <div className="flex flex-col h-full rounded-2xl border border-fg/10 bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-fg/10">
        <span className="relative h-9 w-9 shrink-0 rounded-full bg-accent-primary text-white grid place-items-center text-sm font-bold" aria-hidden>
          MA<span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[var(--t-card)]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg leading-tight">Asistente de Mariano</p>
          <p className="text-xs text-fg-500">Preguntame lo que quieras de tu informe.</p>
        </div>
      </div>

      <div className="flex-1 min-h-[280px] overflow-y-auto overscroll-contain px-4 py-4 space-y-3" aria-live="polite">
        {mensajes.map(m => (
          <div key={m.id}
            className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.rol === 'cliente'
              ? 'ml-auto bg-accent-primary text-white rounded-br-md'
              : 'bg-card-2 text-fg-200 rounded-bl-md'}`}>
            <Texto texto={m.texto} />
          </div>
        ))}
        {escribiendo && (
          <div className="bg-card-2 rounded-2xl rounded-bl-md px-3.5 py-3 w-16 flex gap-1" aria-label="Escribiendo">
            {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-fg-500 animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />)}
          </div>
        )}
        {!escribiendo && !form && !enviado && (
          <div className="flex flex-wrap gap-1.5">
            {SUGERENCIAS.map(s => (
              <button key={s} type="button" onClick={() => onSugerencia(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-fg/15 text-fg-300 hover:border-accent-primary hover:text-accent-primary transition-colors">{s}</button>
            ))}
          </div>
        )}
        {form && !enviado && (
          <FormPresupuesto auditoriaId={auditoriaId} clave={clave} negocioId={negocioId}
            servicios={form.servicios} chat={mensajes}
            onToggle={(id) => setForm(f => { const s = new Set(f.servicios); if (s.has(id)) s.delete(id); else s.add(id); return { servicios: s }; })}
            onCerrar={() => setForm(null)}
            onEnviado={() => { setEnviado(true); setForm(null); }} />
        )}
        {enviado && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-fg-200">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">¡Listo, pedido recibido! 🙌</p>
            <p className="mt-1">Mariano te escribe hoy. Si querés adelantarte, mandale un WhatsApp.</p>
          </div>
        )}
        <div ref={fin} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex gap-2 px-3 py-3 border-t border-fg/10">
        <label htmlFor="asesor-input" className="sr-only">Escribí tu pregunta</label>
        <input id="asesor-input" value={texto} onChange={e => setTexto(e.target.value)} maxLength={1000}
          placeholder="Escribí tu pregunta…" autoComplete="off"
          className="flex-1 min-w-0 rounded-xl border border-fg/15 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary" />
        <button type="submit" disabled={!texto.trim() || escribiendo} className="rounded-xl bg-accent-primary text-white text-sm font-semibold px-4 disabled:opacity-40">Enviar</button>
      </form>

      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <button type="button" onClick={pedirForm} disabled={enviado}
          className="rounded-xl bg-fg text-page text-xs font-semibold py-2.5 hover:opacity-90 disabled:opacity-40">
          Quiero el presupuesto
        </button>
        <a href={whatsappUrl(WHATSAPP_MARIANO, mensajeDesdeInforme(negocioNombre))} target="_blank" rel="noopener noreferrer"
          className="rounded-xl bg-emerald-600 text-white text-xs font-semibold py-2.5 text-center hover:opacity-90">
          WhatsApp a Mariano
        </a>
      </div>
    </div>
  );
}

function FormPresupuesto({ auditoriaId, clave, negocioId, servicios, chat, onToggle, onCerrar, onEnviado }) {
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true); setError('');
    try {
      const res = await fetch('/api/auditorias/solicitud/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: auditoriaId, k: clave, para: negocioId, nombre, contacto, mensaje,
          servicios: [...servicios], chat: chat.map(m => ({ rol: m.rol, texto: m.texto })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar');
      track('generate_lead', { origen: 'auditoria', auditoria_id: auditoriaId });
      onEnviado();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const campo = 'w-full rounded-lg border border-fg/15 bg-page px-2.5 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary';
  return (
    <form onSubmit={enviar} className="rounded-2xl border border-accent-primary/30 bg-page/60 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-fg">Pedí tu presupuesto</p>
        <button type="button" onClick={onCerrar} className="text-fg-500 hover:text-fg text-sm leading-none" aria-label="Cerrar">✕</button>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-[11px] text-fg-500 mb-1">¿Qué te interesa?</legend>
        {SERVICIOS_OFERTA.map(s => (
          <label key={s.id} className="flex items-start gap-2 text-xs text-fg-300 cursor-pointer">
            <input type="checkbox" checked={servicios.has(s.id)} onChange={() => onToggle(s.id)} className="mt-0.5" />
            <span>{s.icon} {s.titulo}</span>
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="sr-only">Tu nombre</span>
        <input required value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} placeholder="Tu nombre" autoComplete="name" className={campo} />
      </label>
      <label className="block">
        <span className="sr-only">WhatsApp o email</span>
        <input required value={contacto} onChange={e => setContacto(e.target.value)} maxLength={120} placeholder="WhatsApp o email" autoComplete="tel" className={campo} />
      </label>
      <label className="block">
        <span className="sr-only">Algo más que quieras contar</span>
        <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} maxLength={1500} rows={2} placeholder="¿Algo más? (opcional)" className={`${campo} resize-y`} />
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button type="submit" disabled={enviando || !nombre.trim() || !contacto.trim()}
        className="w-full rounded-xl bg-accent-primary text-white text-sm font-semibold py-2.5 disabled:opacity-40">
        {enviando ? 'Enviando…' : 'Enviar pedido'}
      </button>
      <p className="text-[11px] text-fg-500">Sin compromiso. Mariano te contacta para charlarlo.</p>
    </form>
  );
}
