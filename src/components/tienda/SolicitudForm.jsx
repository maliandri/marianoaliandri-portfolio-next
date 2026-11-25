'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Pedido de presupuesto: datos + notas + Meet opcional (turnos libres del calendario de Mariano) o "prefiero que me
// escriban". Se muestra como diálogo; pide sesión de Google antes de enviar.
const ART = 'America/Argentina/Buenos_Aires';
const dia = (iso) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ART, weekday: 'long', day: 'numeric', month: 'long' });
const hora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { timeZone: ART, hour: '2-digit', minute: '2-digit', hour12: false });

export default function SolicitudForm({ pedido, user, authListo, onLogin, onEnviar, onCerrar, enviando, error }) {
  const [cliente, setCliente] = useState({ nombre: '', email: '', telefono: '', empresa: '', notas: '' });
  const [horarios, setHorarios] = useState(null); // { disponible, turnos }
  const [turno, setTurno] = useState('');          // ISO o '' = prefiero que me escriban
  const [trampa, setTrampa] = useState('');
  const dlg = useRef(null);

  useEffect(() => {
    if (user) setCliente(c => ({ ...c, nombre: c.nombre || user.displayName || '', email: c.email || user.email || '' }));
  }, [user]);
  useEffect(() => {
    fetch('/api/tienda/horarios/').then(r => r.json()).then(setHorarios).catch(() => setHorarios({ disponible: false, turnos: [] }));
  }, []);
  useEffect(() => {
    const prev = document.activeElement;
    dlg.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, [onCerrar]);

  const porDia = useMemo(() => {
    const m = new Map();
    for (const t of horarios?.turnos || []) { const d = dia(t); if (!m.has(d)) m.set(d, []); m.get(d).push(t); }
    return [...m].slice(0, 6);
  }, [horarios]);

  const input = 'w-full rounded-lg border border-fg/15 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary';
  const set = (k) => (e) => setCliente({ ...cliente, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCerrar}>
      <div ref={dlg} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="solicitud-titulo" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-fg/10 p-5 sm:p-6 outline-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="solicitud-titulo" className="font-[family-name:var(--font-ia-display)] text-2xl font-bold text-fg">Pedí tu presupuesto</h2>
            <p className="text-sm text-fg-400 mt-1">Lo reviso, lo charlamos y te paso el precio cerrado. No pagás nada ahora.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="h-8 w-8 rounded-full text-fg-500 hover:bg-fg/10">✕</button>
        </div>

        <p className="mt-4 font-[family-name:var(--font-ia-mono)] text-xs text-fg-400">{pedido.map(s => s.label).join(' · ')}</p>

        {!user ? (
          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-fg-300">Entrá con tu cuenta de Google para mandarme el pedido. Así te puedo responder y no se pierde nada.</p>
            <button type="button" onClick={onLogin} disabled={!authListo}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-900 font-semibold px-5 py-3 border border-fg/15 hover:bg-gray-100 disabled:opacity-50">
              Entrar con Google
            </button>
          </div>
        ) : (
          <form className="mt-5 space-y-5" onSubmit={(e) => { e.preventDefault(); onEnviar({ cliente, meet: turno ? { inicio: turno } : null, website: trampa }); }}>
            <fieldset className="grid gap-2.5">
              <legend className="text-sm font-semibold text-fg mb-2">Tus datos</legend>
              <input required placeholder="Tu nombre" autoComplete="name" value={cliente.nombre} onChange={set('nombre')} className={input} />
              <input required type="email" placeholder="Email" autoComplete="email" value={cliente.email} onChange={set('email')} className={input} />
              <div className="grid grid-cols-2 gap-2.5">
                <input placeholder="WhatsApp" autoComplete="tel" value={cliente.telefono} onChange={set('telefono')} className={`${input} min-w-0`} />
                <input placeholder="Tu negocio" autoComplete="organization" value={cliente.empresa} onChange={set('empresa')} className={`${input} min-w-0`} />
              </div>
              <textarea rows={3} placeholder="Contame a qué se dedica tu negocio y qué te gustaría lograr (opcional)" value={cliente.notas} onChange={set('notas')} className={input} />
              <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={trampa} onChange={e => setTrampa(e.target.value)} name="website" />
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-fg mb-1">¿Charlamos por Meet?</legend>
              <p className="text-xs text-fg-500 mb-3">Una reunión corta por videollamada (30 min). Elegí un horario y te llega la invitación cuando lo confirme.</p>
              <label className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer mb-3 ${turno === '' ? 'border-accent-primary bg-accent-primary/5 text-fg' : 'border-fg/15 text-fg-300'}`}>
                <input type="radio" name="turno" checked={turno === ''} onChange={() => setTurno('')} className="accent-[#4c01f9]" />
                Prefiero que me escriban por WhatsApp o mail
              </label>
              {horarios === null && <p className="text-xs text-fg-500">Buscando horarios libres…</p>}
              {horarios && !horarios.disponible && <p className="text-xs text-fg-500">Ahora no hay horarios para elegir: te escribo y coordinamos.</p>}
              <div className="space-y-3">
                {porDia.map(([d, turnos]) => (
                  <div key={d}>
                    <p className="text-xs font-semibold text-fg-300 capitalize mb-1.5">{d}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {turnos.map(t => (
                        <button key={t} type="button" onClick={() => setTurno(t)} aria-pressed={turno === t}
                          className={`font-[family-name:var(--font-ia-mono)] text-xs px-3 py-1.5 rounded-lg border tabular-nums ${turno === t ? 'bg-accent-primary text-white border-accent-primary' : 'border-fg/15 text-fg-200 hover:border-accent-primary'}`}>
                          {hora(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {porDia.length > 0 && <p className="text-[11px] text-fg-500 mt-2">Horarios de Argentina.</p>}
            </fieldset>

            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={enviando}
              className="w-full rounded-xl bg-accent-primary text-white font-semibold py-3 hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary">
              {enviando ? 'Enviando…' : turno ? 'Enviar pedido y pedir el Meet' : 'Enviar pedido'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
