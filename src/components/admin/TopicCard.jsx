'use client';

import { useState } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SELECT_CLASS =
  'text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-gray-900 dark:text-white disabled:opacity-50';

export default function TopicCard({ topic, notes, busy, onToggleActivo, onToggleFoto, onUpdate, onSaveTone, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [toneDraft, setToneDraft] = useState(topic.toneInstructions || '');
  const [queryDraft, setQueryDraft] = useState(topic.query || '');

  const publishedCount = notes.filter(n => n.status === 'published').length;

  return (
    <div className="border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <span className={`text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{topic.label}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {publishedCount} publicada{publishedCount === 1 ? '' : 's'}
          </span>
        </button>
        <label className="flex items-center gap-1.5 shrink-0 text-xs">
          <input
            type="checkbox"
            checked={topic.activo}
            disabled={busy}
            onChange={e => onToggleActivo(topic.id, e.target.checked)}
          />
          <span className={topic.activo ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
            {topic.activo ? 'Activo' : 'Inactivo'}
          </span>
        </label>
      </div>

      {expanded && (
        <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5 block">
                Dónde se publica
              </label>
              <select
                value={topic.destino || 'fb_ig'}
                disabled={busy}
                onChange={e => onUpdate(topic.id, { destino: e.target.value })}
                className={`${SELECT_CLASS} w-full`}
              >
                <option value="fb_ig">Facebook + Instagram</option>
                <option value="linkedin">Solo LinkedIn</option>
                <option value="todas">Facebook + Instagram + LinkedIn</option>
                <option value="x">Solo X (no aparece en el sitio)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {topic.destino === 'x'
                  ? 'Estas notas NO se muestran en tu sitio (/noticias): solo salen en X.'
                  : 'Siempre se publica también en el sitio (/noticias).'}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5 block">
                Notas por corrida
              </label>
              <select
                value={topic.maxPorCorrida ?? 2}
                disabled={busy}
                onChange={e => onUpdate(topic.id, { maxPorCorrida: Number(e.target.value) })}
                className={`${SELECT_CLASS} w-full`}
              >
                <option value={1}>1 nota</option>
                <option value={2}>2 notas</option>
                <option value={3}>3 notas</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Máximo de este tópico cada vez que corre el bot (cada hora).</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5 block">
              Búsqueda en Google News
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={queryDraft}
                onChange={e => setQueryDraft(e.target.value)}
                maxLength={200}
                className="flex-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5"
              />
              <button
                type="button"
                onClick={() => onUpdate(topic.id, { query: queryDraft })}
                disabled={busy || !queryDraft.trim() || queryDraft.trim() === (topic.query || '')}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50"
              >
                Guardar
              </button>
              <a
                href={`https://news.google.com/search?q=${encodeURIComponent(queryDraft)}&hl=es-419&gl=AR&ceid=AR:es-419`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2.5 py-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:underline self-center"
              >
                Probar
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-1">Lo que busca el bot. Podés usar OR y comillas. "Probar" abre Google News con esta búsqueda.</p>
          </div>

          <div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={topic.usarFoto !== false}
                disabled={busy}
                onChange={e => onToggleFoto(topic.id, e.target.checked)}
              />
              <span>
                <span className="font-semibold text-gray-900 dark:text-white">Usar la foto del artículo en la imagen</span>
                <span className="block text-gray-400 mt-0.5">
                  Activado: la tarjeta lleva la foto de la nota de fondo (si el artículo no tiene una buena, usa el fondo de marca).
                  Desactivado: siempre fondo de marca con el titular.
                </span>
              </span>
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5 block">
              Tono de este tópico
            </label>
            <textarea
              value={toneDraft}
              onChange={e => setToneDraft(e.target.value)}
              placeholder="Ej: tono periodístico, directo, sin hype, sin frases hechas de marketing"
              rows={3}
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-2"
            />
            <button
              type="button"
              onClick={() => onSaveTone(topic.id, toneDraft)}
              disabled={busy}
              className="mt-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50"
            >
              Guardar tono
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
              Últimas publicaciones
            </p>
            {notes.length === 0 ? (
              <p className="text-xs text-gray-400">Todavía no publicó nada de este tópico.</p>
            ) : (
              <div className="space-y-1">
                {notes.slice(0, 10).map(n => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-gray-800/40 rounded-lg px-3 py-1.5"
                  >
                    <a
                      href={`/noticias/${n.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 dark:text-white truncate hover:underline"
                    >
                      {n.title || '—'}
                    </a>
                    <span className="text-gray-400 shrink-0">{formatDate(n.publishedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => onDelete(topic)}
              disabled={busy}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
            >
              Eliminar tópico
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
