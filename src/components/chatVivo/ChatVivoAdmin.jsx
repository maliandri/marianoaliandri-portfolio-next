'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { adminFetch } from '@/utils/adminFetch';

// /admin/chat/<id>/: Mariano ve la charla del cliente con el asistente en vivo, toma el control (la IA deja de
// contestar) y le escribe. Pensada para abrir desde Telegram en el celular. Solo la cuenta admin (lo valida la API).
const POLL_MS = 3000;
const ROL = {
  cliente:   { quien: 'Cliente', cls: 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-neutral-700 mr-auto rounded-bl-md' },
  asistente: { quien: 'IA',      cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-gray-800 dark:text-gray-200 ml-auto rounded-br-md' },
  mariano:   { quien: 'Vos',     cls: 'bg-emerald-600 text-white ml-auto rounded-br-md' },
};
const hora = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function ChatVivoAdmin({ chatId }) {
  const { user, loading: authLoading, login } = useAuthUser();
  const [chat, setChat] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargado, setCargado] = useState(false);
  const ultimo = useRef(0);
  const fin = useRef(null);

  const traer = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/chat-vivo/admin/?id=${encodeURIComponent(chatId)}&desde=${ultimo.current}`);
      const d = await res.json();
      if (!res.ok) throw new Error(res.status === 403 ? 'Esta cuenta no es la de administración.' : (d.error || `Error ${res.status}`));
      setError('');
      setChat(d.chat);
      if (d.mensajes?.length) {
        ultimo.current = d.mensajes[d.mensajes.length - 1].ms;
        setMensajes(prev => {
          const vistos = new Set(prev.map(m => m.id));
          return [...prev, ...d.mensajes.filter(m => !vistos.has(m.id))];
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCargado(true);
    }
  }, [chatId]);

  useEffect(() => {
    if (authLoading || !user) return undefined;
    traer();
    const t = setInterval(() => { if (document.visibilityState === 'visible') traer(); }, POLL_MS);
    return () => clearInterval(t);
  }, [authLoading, user, traer]);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [mensajes.length]);

  const enviar = async (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const res = await adminFetch('/api/chat-vivo/admin/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: chatId, texto: t }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar');
      setTexto('');
      setChat(c => (c ? { ...c, estado: 'humano' } : c));
      await traer();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const cambiar = async (estado) => {
    const res = await adminFetch('/api/chat-vivo/admin/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: chatId, estado }) });
    if (res.ok) setChat(c => ({ ...c, estado }));
  };

  if (authLoading) return <Centro>Cargando…</Centro>;
  if (!user) {
    return (
      <Centro>
        <p className="mb-4 text-gray-600 dark:text-gray-300">Entrá con la cuenta de administración para ver el chat.</p>
        <button onClick={login} className="px-5 py-3 rounded-xl bg-gray-900 text-white font-semibold">Entrar con Google</button>
      </Centro>
    );
  }

  const humano = chat?.estado === 'humano';
  const origen = chat?.origen === 'auditoria' ? 'Auditoría privada' : chat?.origen === 'tienda' ? 'Tienda' : 'Chat';
  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-gray-200 dark:border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-gray-500">{origen}</p>
            <h1 className="font-semibold text-gray-900 dark:text-white truncate">{chat?.titulo || 'Esperando que el cliente escriba…'}</h1>
          </div>
          {chat && (
            <button onClick={() => cambiar(humano ? 'ia' : 'humano')}
              className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg ${humano ? 'bg-gray-100 dark:bg-neutral-800 text-gray-800 dark:text-gray-200' : 'bg-emerald-600 text-white'}`}>
              {humano ? 'Devolver a la IA' : 'Tomar el control'}
            </button>
          )}
        </div>
        <p className={`mt-1 text-xs max-w-2xl mx-auto ${humano ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500'}`}>
          {humano ? '● Estás vos: la IA no contesta. Lo que escribas le aparece al cliente en su chat.' : 'Contesta la IA. Si escribís, tomás el control.'}
        </p>
        {chat?.contexto?.url && (
          <p className="max-w-2xl mx-auto"><a href={chat.contexto.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline">Ver lo que está mirando</a></p>
        )}
      </header>

      <main className="flex-1 px-3 py-4 space-y-2.5 max-w-2xl w-full mx-auto flex flex-col">
        {cargado && !chat && <p className="text-center text-sm text-gray-500 mt-10">Todavía no hay mensajes en este chat.</p>}
        {mensajes.map(m => {
          const r = ROL[m.rol] || ROL.asistente;
          return (
            <div key={m.id} className={`max-w-[85%] w-fit rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${r.cls}`}>
              <p className="text-[10px] font-semibold opacity-60 mb-0.5">{r.quien} · {hora(m.ms)}</p>
              {m.texto}
            </div>
          );
        })}
        <div ref={fin} />
      </main>

      {error && <p className="px-4 pb-2 text-sm text-red-600 text-center">{error}</p>}

      <form onSubmit={enviar} className="sticky bottom-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 p-3">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <label htmlFor="chat-vivo-input" className="sr-only">Mensaje para el cliente</label>
          <textarea id="chat-vivo-input" value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={2000}
            disabled={!chat} placeholder={chat ? 'Escribile al cliente…' : 'Esperando al cliente…'}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) enviar(e); }}
            className="flex-1 min-w-0 resize-none rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-3 py-2 text-sm text-gray-900 dark:text-white" />
          <button type="submit" disabled={!texto.trim() || enviando || !chat} className="rounded-xl bg-emerald-600 text-white font-semibold px-4 disabled:opacity-40">
            {enviando ? '…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Centro({ children }) {
  return <div className="min-h-[100dvh] grid place-items-center p-6 text-center"><div>{children}</div></div>;
}
