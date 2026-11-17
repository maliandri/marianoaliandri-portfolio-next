'use client';

import { useState } from 'react';
import { adminFetch } from '@/utils/adminFetch';

const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';
const EJEMPLOS = [
  'Buscame ferreterías y corralones en Cipolletti con la web floja y dejame los mails listos.',
  'Mirá qué rubros se buscan más en Neuquén y armame 5 prospectos del mejor, con borradores.',
  'Revisá las auditorías que ya tengo y dejame mails para los de peor puntaje SEO que no contacté.',
];

const MOTIVO = {
  baja: 'pidió no recibir más mails',
  rebotado: 'esa dirección rebotó o marcó spam',
  ya_contactado: 'ya se le escribió hace menos de 30 días',
  tope_diario: 'se llegó al tope diario de mails',
};

// Agente de prospección (AI SDK + Gemini). Usa las tools del MCP en ciclo, pero SOLO puede redactar: cada
// mail lo aprobás y lo mandás vos desde acá, y el servidor aplica sus frenos al enviar.
export default function ProspectingAgentCard() {
  const [objetivo, setObjetivo] = useState('');
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);
  const [estado, setEstado] = useState({}); // draftId → { texto, ok } | 'enviando' | 'descartado'

  const correr = async () => {
    setCorriendo(true); setError(''); setRes(null); setEstado({});
    try {
      const r = await adminFetch('/api/agente-prospeccion/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objetivo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
      setRes(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setCorriendo(false);
    }
  };

  const enviar = async (b) => {
    if (!window.confirm(`¿Enviar este mail a ${b.to}? Sale de verdad, desde notificaciones@marianoaliandri.com.ar.`)) return;
    setEstado(s => ({ ...s, [b.draftId]: 'enviando' }));
    try {
      const r = await adminFetch('/api/agente-prospeccion/enviar/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId: b.draftId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
      setEstado(s => ({ ...s, [b.draftId]: d.enviado ? { texto: `Enviado a ${b.to}`, ok: true } : { texto: `No se envió: ${MOTIVO[d.motivo] || d.motivo}`, ok: false } }));
    } catch (e) {
      setEstado(s => ({ ...s, [b.draftId]: { texto: e.message, ok: false } }));
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Agente de prospección</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
          Le decís qué querés lograr; busca y audita leads, elige los mejores y deja borradores de mail. <strong>No envía nada solo</strong>:
          cada mail lo aprobás vos abajo. Las búsquedas nuevas gastan cupo de Google Places (con tope diario).
        </p>
        <textarea
          value={objetivo} onChange={e => setObjetivo(e.target.value)} rows={3} maxLength={1000} disabled={corriendo}
          placeholder="Ej: Buscame estudios contables en Neuquén con la web floja y dejame los mails listos."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm p-2 text-gray-900 dark:text-gray-100"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {EJEMPLOS.map(e => (
            <button key={e} type="button" disabled={corriendo} onClick={() => setObjetivo(e)}
              className="text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-left disabled:opacity-50">
              {e}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button type="button" onClick={correr} disabled={corriendo || objetivo.trim().length < 10}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
            {corriendo ? 'Trabajando… (puede tardar unos minutos)' : 'Correr agente'}
          </button>
          {corriendo && <span className="text-xs text-gray-500" role="status">No cierres esta pantalla.</span>}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{error}</p>}
      </div>

      {res && (
        <>
          <div className={card}>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Informe</h4>
            <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">{res.texto}</p>
          </div>

          <div className={card}>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Borradores para aprobar ({res.borradores.length})</h4>
            {!res.borradores.length && <p className="text-sm text-gray-500">El agente no dejó borradores esta vez.</p>}
            <ul className="space-y-3">
              {res.borradores.map(b => {
                const st = estado[b.draftId];
                const hecho = st && st !== 'enviando';
                return (
                  <li key={b.draftId} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm">
                    <p className="font-semibold text-gray-900 dark:text-white">{b.subject}</p>
                    <p className="text-xs text-gray-500">Para: {b.to}</p>
                    {b.bloqueo && <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">No se le puede escribir: {MOTIVO[b.bloqueo] || b.bloqueo}.</p>}
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">Ver texto</summary>
                      <p className="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300 mt-1">{b.emailText}</p>
                    </details>
                    <div className="flex items-center gap-2 mt-2">
                      {st && st.texto && <span className={`text-xs ${st.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{st.texto}</span>}
                      {st === 'descartado' && <span className="text-xs text-gray-500">Descartado</span>}
                      {!hecho && (
                        <>
                          <button type="button" disabled={st === 'enviando' || !!b.bloqueo} onClick={() => enviar(b)}
                            className="text-xs px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50">
                            {st === 'enviando' ? 'Enviando…' : 'Aprobar y enviar'}
                          </button>
                          <button type="button" disabled={st === 'enviando'} onClick={() => setEstado(s => ({ ...s, [b.draftId]: 'descartado' }))}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">
                            Descartar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <details className={card}>
            <summary className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">Qué hizo el agente ({res.pasos.length} pasos)</summary>
            <ol className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300 list-decimal pl-5">
              {res.pasos.map((p, i) => (
                <li key={i} className={p.ok ? '' : 'text-red-600 dark:text-red-400'}>
                  <code>{p.tool}</code> — {p.resumen} <span className="text-gray-400">({Math.round(p.ms / 100) / 10} s)</span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
