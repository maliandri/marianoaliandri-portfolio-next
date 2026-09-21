'use client';

import { useState, useEffect, useCallback } from 'react';

const QUIZ_URL = 'https://marianoaliandri.com.ar/estilo/';
const SHARE_TEXT = `Hola! Te comparto un test rápido (2 minutos) para definir juntos el estilo visual de tu sitio: ${QUIZ_URL}`;

function ShareButton() {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      Compartir por WhatsApp
    </a>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StyleQuizManager() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [expanded, setExpanded]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/style-quiz');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setResponses(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  if (!responses.length) {
    return (
      <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400 space-y-4">
        <p>
          Todavía no hay respuestas. Mandale a un cliente el link{' '}
          <code className="bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">marianoaliandri.com.ar/estilo</code>.
        </p>
        <ShareButton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Respuestas del test de estilo</p>
          <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">{responses.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton />
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      {responses.map(r => {
        const isOpen = expanded === r.id;
        return (
          <div key={r.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
              onClick={() => setExpanded(isOpen ? null : r.id)}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {r.email || r.phone || 'Sin contacto'} · {formatDate(r.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  {(r.likedStyles || []).length} estilo{(r.likedStyles || []).length === 1 ? '' : 's'}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-neutral-800 pt-4">
                <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                  {r.email && <span>{r.email}</span>}
                  {r.phone && (
                    <a href={`https://wa.me/${r.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 hover:underline">
                      {r.phone}
                    </a>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Estilos elegidos</p>
                  {(r.likedStyles || []).length ? (
                    <ul className="space-y-1.5">
                      {r.likedStyles.map((s, i) => (
                        <li key={i} className="text-sm text-gray-800 dark:text-gray-200">
                          <span className="font-medium">{s.name}</span>
                          {s.comment && <span className="text-gray-500 dark:text-gray-400"> — {s.comment}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ninguno marcado</p>
                  )}
                </div>

                {(r.features || []).length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Features pedidas</p>
                    <div className="flex flex-wrap gap-2">
                      {r.features.map((f, i) => (
                        <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-gray-700 dark:text-gray-300">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {r.comment && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Comentario</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{r.comment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
