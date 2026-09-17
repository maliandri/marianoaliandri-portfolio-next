'use client';

import { useState } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Botón de envío de email de auditoría — reusado por AuditoriasManager (vista por
// reporte) y AuditoriasUnificado (vista consolidada). Nunca bloquea el reenvío: si
// ya se mandó antes, permite reescribir el texto y volver a enviar, y el contador
// de envíos persiste vía la colección `sent_emails` (prop `sentCount`, ver
// /api/auditorias/email-counts y /api/auditorias/unificado).
export default function SendAuditEmailButton({ neg, auditoriaId, sentCount = 0, lastSentAt = null, onSent }) {
  const [open, setOpen]                   = useState(false);
  const [busy, setBusy]                   = useState(null); // 'generating' | 'sending' | null
  const [localCount, setLocalCount]       = useState(sentCount);
  const [localLastSent, setLocalLastSent] = useState(lastSentAt);
  const [emailText, setEmailText]         = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [source, setSource]               = useState(null); // 'gemini' | 'template' | 'edited'
  const [extraServices, setExtraServices] = useState([]);
  const [errorMsg, setErrorMsg]           = useState('');

  const payload = {
    auditoriaId,
    nombre:     neg.nombre,
    siteUrl:    neg.siteUrl,
    email:      neg.email,
    seoScore:   neg.seoScore,
    hasSitemap: neg.hasSitemap,
    hasRobots:  neg.hasRobots,
    metaDesc:   neg.metaDesc,
    hasOG:      neg.hasOG,
    ciudad:     neg.ciudad,
    tipo:       neg.tipo,
  };

  // Paso 1: generar el texto con Gemini (sin enviar) y abrir el preview
  const generate = async () => {
    setBusy('generating'); setErrorMsg('');
    try {
      const resp = await fetch('/api/auditorias/send-biz-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, preview: true }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al generar');
      setEmailText(data.emailText || '');
      setScreenshotUrl(data.screenshotUrl || null);
      setSource(data.source || null);
      setExtraServices(data.extraServices || []);
      setOpen(true);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Paso 2: enviar exactamente el texto que se ve (editado) — siempre disponible,
  // aunque ya se haya enviado antes (reenvío = otro registro más en sent_emails).
  const send = async () => {
    setBusy('sending'); setErrorMsg('');
    try {
      const resp = await fetch('/api/auditorias/send-biz-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, emailText, screenshotUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al enviar');
      setLocalCount(c => c + 1);
      setLocalLastSent(new Date().toISOString());
      if (onSent) onSent(neg.email);
      setOpen(false);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!neg.email) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>;

  return (
    <div className="flex items-center gap-1.5 min-w-[180px]">
      <span className="text-xs text-green-600 dark:text-green-400 truncate max-w-[120px]" title={neg.email}>
        {neg.email}
      </span>
      <button
        onClick={generate}
        disabled={busy === 'generating'}
        title={localCount > 0 ? `Enviado ${localCount} vez${localCount !== 1 ? 'es' : ''} — click para reescribir y reenviar` : `Generar email para ${neg.email}`}
        className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium transition-colors
          ${localCount > 0         ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
          : busy === 'generating' ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-wait'
          : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'}`}>
        {busy === 'generating' && !open ? '⏳ Generando…' : localCount > 0 ? `↻ Reenviar (${localCount})` : '✉ Generar'}
      </button>
      {!open && errorMsg && (
        <span className="text-[10px] text-red-500 max-w-[130px] truncate" title={errorMsg}>{errorMsg}</span>
      )}

      {/* Modal de preview */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Preview del email</h3>
                <p className="text-xs text-gray-500 mt-0.5">Para <strong>{neg.nombre}</strong> · {neg.email}</p>
                {localCount > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    ✉ Ya se envió {localCount} vez{localCount !== 1 ? 'es' : ''} · último: {formatDate(localLastSent)}
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(false)} disabled={!!busy}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none disabled:opacity-40">✕</button>
            </div>

            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Cuerpo del email (podés editarlo)</label>
              {source === 'gemini'   && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">✨ IA (Gemini)</span>}
              {source === 'template' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" title="Gemini no disponible — se usó una plantilla">✍️ Plantilla</span>}
            </div>
            <textarea
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              rows={10}
              disabled={!!busy}
              className="w-full text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-3 text-gray-700 dark:text-gray-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-y disabled:opacity-60"
            />

            {extraServices.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1">También se incluyen estos links (según el rubro)</p>
                <div className="flex flex-wrap gap-1.5">
                  {extraServices.map(s => (
                    <span key={s.label} className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      {s.icon} {s.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {screenshotUrl && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Captura del sitio que se adjunta</p>
                <img src={screenshotUrl} alt="" className="w-full rounded-xl border border-gray-200 dark:border-neutral-800" />
              </div>
            )}

            {errorMsg && <p className="mt-3 text-xs text-red-500">{errorMsg}</p>}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={generate} disabled={!!busy}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-40">
                {busy === 'generating' ? '↻ Regenerando…' : '↻ Regenerar'}
              </button>
              <button onClick={() => setOpen(false)} disabled={!!busy}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={send} disabled={!!busy || !emailText.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {busy === 'sending' ? 'Enviando…' : localCount > 0 ? `↻ Reenviar a ${neg.email}` : `✉ Enviar a ${neg.email}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
