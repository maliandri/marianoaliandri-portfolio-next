'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { adminFetch } from '@/utils/adminFetch';
import { armarFilas } from '@/lib/ai/agentRunView';

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
const TOOL = {
  rank_rubros_by_demand: 'Rubros más buscados',
  search_leads: 'Lanzar búsqueda de leads',
  get_lead_search: 'Revisar resultados de la búsqueda',
  list_lead_searches: 'Historial de búsquedas',
  list_audits: 'Listar auditorías',
  get_audit: 'Leer una auditoría',
  draft_business_email: 'Redactar mail',
  list_sent_emails: 'Mails ya enviados',
  list_ig_prospects: 'Prospectos de Instagram',
  esperar: 'Esperar',
};
const ESTADO = {
  corriendo: { txt: 'Trabajando', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  listo: { txt: 'Listo', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  error: { txt: 'Falló', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  cortado: { txt: 'Se cortó', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
};

const seg = (ms) => `${Math.max(0, Math.round(ms / 1000))} s`;
const argsTxt = (a) => Object.entries(a || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');

function Fila({ f }) {
  if (f.tipo === 'herramienta') {
    const corriendo = f.fase !== 'fin';
    return (
      <li className="flex gap-2">
        <span aria-hidden="true">{corriendo ? '⏳' : f.ok ? '✅' : '⚠️'}</span>
        <div className="min-w-0">
          <p className="text-gray-900 dark:text-gray-100">
            <span className="font-medium">{TOOL[f.tool] || f.tool}</span>
            {corriendo && <span className="text-gray-500"> — en curso…</span>}
            {!corriendo && <span className="text-gray-400 text-xs"> ({seg(f.ms)})</span>}
          </p>
          {argsTxt(f.args) && <p className="text-xs text-gray-500 break-words">{argsTxt(f.args)}</p>}
          {!corriendo && f.resumen && <p className={`text-xs break-words ${f.ok ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'}`}>{f.resumen}</p>}
        </div>
      </li>
    );
  }
  const ICONO = { inicio: '🚀', modelo: '🧠', texto: '💬', borrador: '✉️', error: '❌', fin: '🏁' };
  return (
    <li className="flex gap-2">
      <span aria-hidden="true">{ICONO[f.tipo] || '•'}</span>
      <p className={`whitespace-pre-line break-words ${f.tipo === 'texto' ? 'italic text-gray-600 dark:text-gray-300' : f.tipo === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>{f.texto}</p>
    </li>
  );
}

// Agente de prospección (AI SDK + Gemini). Usa las tools del MCP en ciclo, pero SOLO puede redactar: cada
// mail lo aprobás y lo mandás vos desde acá, y el servidor aplica sus frenos al enviar. La corrida va en
// segundo plano y esta pantalla muestra cada paso a medida que ocurre.
export default function ProspectingAgentCard() {
  const [objetivo, setObjetivo] = useState('');
  const [run, setRun] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const [estado, setEstado] = useState({}); // draftId → { texto, ok } | 'enviando' | 'descartado'
  const desde = useRef(0);
  const fin = useRef(null);

  const cargarHistorial = useCallback(async () => {
    try {
      const r = await adminFetch('/api/agente-prospeccion/');
      const d = await r.json();
      if (r.ok) { setHistorial(d.runs || []); return d.runs || []; }
    } catch { /* sin historial */ }
    return [];
  }, []);

  const consultar = useCallback(async (id) => {
    const r = await adminFetch(`/api/agente-prospeccion/?id=${encodeURIComponent(id)}&desde=${desde.current}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    const nuevos = d.run.eventos || [];
    if (nuevos.length) desde.current = nuevos[nuevos.length - 1].seq;
    setRun(prev => ({ ...d.run, eventos: [...(prev && prev.id === d.run.id ? prev.eventos : []), ...nuevos] }));
    return d.run;
  }, []);

  const abrir = useCallback(async (id) => {
    desde.current = 0;
    setRun(null); setEstado({}); setError('');
    try { await consultar(id); } catch (e) { setError(e.message); }
  }, [consultar]);

  // Al entrar: historial y, si hay una corrida en curso, engancharse a ella (sobrevive a recargar la página).
  useEffect(() => {
    (async () => {
      const runs = await cargarHistorial();
      if (runs[0]?.estado === 'corriendo') abrir(runs[0].id);
    })();
  }, [cargarHistorial, abrir]);

  // Mientras corre: consultar el avance cada 2 s y mover el reloj.
  const corriendo = run?.estado === 'corriendo';
  useEffect(() => {
    if (!corriendo) return undefined;
    const poll = setInterval(() => consultar(run.id).catch(e => setError(e.message)), 2000);
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(reloj); };
  }, [corriendo, run?.id, consultar]);

  useEffect(() => { if (!corriendo) cargarHistorial(); }, [corriendo, cargarHistorial]);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [run?.eventos?.length]);

  const correr = async () => {
    setIniciando(true); setError('');
    try {
      const r = await adminFetch('/api/agente-prospeccion/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objetivo }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && d.runId) { await abrir(d.runId); return; }
      if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
      await abrir(d.runId);
    } catch (e) {
      setError(e.message);
    } finally {
      setIniciando(false);
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

  const filas = run ? armarFilas(run.eventos || []) : [];
  const est = ESTADO[run?.estado] || ESTADO.cortado;
  const duracion = run ? ((run.finMs || (corriendo ? ahora : run.creadoMs)) - run.creadoMs) : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Agente de prospección</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
          Le decís qué querés lograr; busca y audita leads, elige los mejores y deja borradores de mail. <strong>No envía nada solo</strong>:
          cada mail lo aprobás vos abajo. Las búsquedas nuevas gastan cupo de Google Places (con tope diario). Podés cerrar esta pantalla: la
          corrida sigue sola y la retomás al volver.
        </p>
        <textarea
          value={objetivo} onChange={e => setObjetivo(e.target.value)} rows={3} maxLength={1000} disabled={corriendo || iniciando}
          placeholder="Ej: Buscame estudios contables en Neuquén con la web floja y dejame los mails listos."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm p-2 text-gray-900 dark:text-gray-100"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {EJEMPLOS.map(e => (
            <button key={e} type="button" disabled={corriendo || iniciando} onClick={() => setObjetivo(e)}
              className="text-xs px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-left disabled:opacity-50">
              {e}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button type="button" onClick={correr} disabled={corriendo || iniciando || objetivo.trim().length < 10}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
            {iniciando ? 'Arrancando…' : corriendo ? 'Hay una corrida en curso' : 'Correr agente'}
          </button>
          {historial.length > 0 && (
            <select value={run?.id || ''} onChange={e => e.target.value && abrir(e.target.value)} aria-label="Corridas anteriores"
              className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 p-2 max-w-xs">
              <option value="">Corridas anteriores…</option>
              {historial.map(h => (
                <option key={h.id} value={h.id}>
                  {new Date(h.creadoMs).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} · {(ESTADO[h.estado] || ESTADO.cortado).txt} · {h.objetivo.slice(0, 40)}
                </option>
              ))}
            </select>
          )}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{error}</p>}
      </div>

      {run && (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${est.cls}`}>
                {corriendo && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-1.5 align-middle" aria-hidden="true" />}
                {est.txt}
              </span>
              <span className="text-xs text-gray-500" role="status">{seg(duracion)} · {filas.filter(f => f.tipo === 'herramienta' && f.fase === 'fin').length} pasos · {(run.eventos || []).filter(e => e.tipo === 'borrador').length} borradores</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{run.objetivo}</p>
            <ol className="space-y-2 text-sm max-h-[28rem] overflow-y-auto pr-1" aria-live="polite">
              {filas.map((f, i) => <Fila key={`${f.seq ?? i}`} f={f} />)}
              {corriendo && <li className="text-xs text-gray-400 pl-6">…</li>}
              <li ref={fin} />
            </ol>
            {run.error && <p className="text-sm text-red-600 dark:text-red-400 mt-2" role="alert">{run.error}</p>}
          </div>

          {run.texto && (
            <div className={card}>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Informe</h4>
              <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">{run.texto}</p>
            </div>
          )}

          {(run.borradores || []).length > 0 && (
            <div className={card}>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Borradores para aprobar ({run.borradores.length})</h4>
              <ul className="space-y-3">
                {run.borradores.map(b => {
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
          )}
        </>
      )}
    </div>
  );
}
