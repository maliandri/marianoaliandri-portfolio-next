'use client';

import { useMemo, useState } from 'react';
import { hasProblem, timeAgo, DESTINO_LABEL } from './noticiasUtils';

const SELECT =
  'text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-gray-900 dark:text-white';

export default function NoticiasFeed({ log, topics }) {
  const [topicId, setTopicId] = useState('');
  const [destino, setDestino] = useState('');
  const [estado, setEstado] = useState('');
  const [open, setOpen] = useState(null);
  const [visible, setVisible] = useState(25);

  const filtered = useMemo(
    () =>
      log.filter(n => {
        if (topicId && n.topicId !== topicId) return false;
        if (destino && (n.destino || 'fb_ig') !== destino) return false;
        if (estado === 'ok' && hasProblem(n)) return false;
        if (estado === 'problema' && !hasProblem(n)) return false;
        return true;
      }),
    [log, topicId, destino, estado]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={topicId} onChange={e => { setTopicId(e.target.value); setVisible(25); }} className={SELECT}>
          <option value="">Todos los tópicos</option>
          {topics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={destino} onChange={e => { setDestino(e.target.value); setVisible(25); }} className={SELECT}>
          <option value="">Todos los destinos</option>
          {Object.entries(DESTINO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={estado} onChange={e => { setEstado(e.target.value); setVisible(25); }} className={SELECT}>
          <option value="">Todas</option>
          <option value="ok">Sin problemas</option>
          <option value="problema">Con problema</option>
        </select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} notas</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400">No hay notas con esos filtros.</p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.slice(0, visible).map(n => {
            const isOpen = open === n.id;
            const problem = hasProblem(n);
            return (
              <li key={n.id} className={`rounded-xl border ${problem ? 'border-red-200 dark:border-red-900/40' : 'border-gray-200 dark:border-gray-700'}`}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : n.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left"
                >
                  {n.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.imageUrl} alt="" loading="lazy" className="w-9 h-11 object-cover rounded-md shrink-0 bg-gray-200" />
                  ) : (
                    <div className="w-9 h-11 rounded-md shrink-0 bg-gray-100 dark:bg-gray-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{n.title || '—'}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {n.topicLabel || 'sin tópico'} · {DESTINO_LABEL[n.destino || 'fb_ig'] || n.destino}
                      {n.imageMode ? ` · ${n.imageMode === 'foto' ? 'con foto' : 'fondo de marca'}` : ''}
                      {!n.visibleEnSitio ? ' · no en el sitio' : ''}
                    </p>
                  </div>
                  <span className={`text-[11px] shrink-0 ${problem ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {problem ? '⚠ problema' : '✓ ok'}
                  </span>
                  <span className="text-[11px] text-gray-400 shrink-0 hidden sm:inline">{timeAgo(n.publishedAt)}</span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 text-xs space-y-1.5 border-t border-gray-100 dark:border-gray-800">
                    {n.makeError && <p className="text-red-500 break-words">Error: {n.makeError}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {n.visibleEnSitio && n.status === 'published' && (
                        <a href={`/noticias/${n.id}/`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          Ver en el sitio
                        </a>
                      )}
                      {n.sourceUrl && (
                        <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          Artículo original
                        </a>
                      )}
                      {n.imageUrl && (
                        <a href={n.imageUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          Imagen
                        </a>
                      )}
                    </div>
                    <p className="text-gray-400">{n.publishedAt ? new Date(n.publishedAt).toLocaleString('es-AR') : '—'}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > visible && (
        <button onClick={() => setVisible(v => v + 25)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          Cargar más
        </button>
      )}
    </div>
  );
}
