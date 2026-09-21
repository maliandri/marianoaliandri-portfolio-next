'use client';

import { summarize, timeAgo, DESTINO_LABEL } from './noticiasUtils';

const CARD = 'bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4';
const LABEL = 'text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2';

export default function NoticiasResumen({ log, config, onGoTo }) {
  const s = summarize(log);
  const cap = config.dailyCap;
  const pct = cap ? Math.min(100, Math.round((s.publishedToday / cap) * 100)) : 0;
  const maxDay = Math.max(1, ...s.perDay.map(d => d.count));

  return (
    <div className="space-y-4">
      <div className={`${CARD} flex flex-wrap items-center gap-x-6 gap-y-1`}>
        <span className={`text-sm font-semibold ${config.active ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}`}>
          ● {config.active ? 'Bot activo' : 'Bot pausado'}
        </span>
        <span className="text-xs text-gray-500">
          Última nota publicada: <strong className="text-gray-900 dark:text-white">{timeAgo(s.lastPublishedAt)}</strong>
        </span>
        <button onClick={() => onGoTo('ajustes')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline ml-auto">
          Horario y tope →
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={CARD}>
          <p className={LABEL}>Hoy</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {s.publishedToday}
            <span className="text-sm font-normal text-gray-400"> {cap ? `/ ${cap} del tope` : 'publicadas (sin tope)'}</span>
          </p>
          {cap ? (
            <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className={`h-full ${pct >= 100 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
            </div>
          ) : null}
          {cap && s.publishedToday >= cap ? (
            <p className="text-[11px] text-amber-600 mt-1">Tope alcanzado: el bot no publica más hoy.</p>
          ) : null}
        </div>

        <div className={CARD}>
          <p className={LABEL}>Últimos 7 días</p>
          <div className="flex items-end gap-1.5 h-12">
            {s.perDay.map(d => (
              <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.count}`}>
                <div className="bg-indigo-500/80 rounded-sm min-h-[2px]" style={{ height: `${(d.count / maxDay) * 100}%` }} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <strong className="text-gray-900 dark:text-white">{s.total7d}</strong> notas
            {s.errors7d > 0 ? <span className="text-red-500"> · {s.errors7d} con problema</span> : null}
          </p>
        </div>

        <div className={CARD}>
          <p className={LABEL}>Por destino (7 días)</p>
          {Object.keys(s.porDestino).length === 0 ? (
            <p className="text-xs text-gray-400">Sin notas en 7 días.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {Object.entries(s.porDestino).map(([d, n]) => (
                <li key={d} className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">{DESTINO_LABEL[d] || d}</span>
                  <strong className="text-gray-900 dark:text-white">{n}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={CARD}>
        <p className={LABEL}>Requiere atención (últimas 48 h)</p>
        {s.attention.length === 0 ? (
          <p className="text-xs text-green-600 dark:text-green-400">Sin errores. Todo salió bien.</p>
        ) : (
          <ul className="space-y-1.5">
            {s.attention.slice(0, 8).map(n => (
              <li key={n.id} className="text-xs bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-red-200 dark:border-red-900/40">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-900 dark:text-white truncate">{n.title || '—'}</span>
                  <span className="text-gray-400 shrink-0">{timeAgo(n.publishedAt)}</span>
                </div>
                <p className="text-red-500 mt-0.5 break-words">{n.makeError || 'Error sin detalle'}</p>
              </li>
            ))}
          </ul>
        )}
        {s.attention.length > 0 ? (
          <button onClick={() => onGoTo('notas')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2">
            Ver todas las notas →
          </button>
        ) : null}
      </div>

      <p className="text-[11px] text-gray-400">Calculado sobre las últimas 150 notas del log.</p>
    </div>
  );
}
