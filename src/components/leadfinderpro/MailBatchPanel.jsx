'use client';

import React, { useMemo, useState } from 'react';
import { buildMailBatches, cleanEmails } from '@/lib/mailBatches';

// Abre el gestor de correo del cliente con las casillas encontradas en CCO, partidas en
// tandas para no pasar el largo máximo del enlace mailto. No manda nada desde el server.
export default function MailBatchPanel({ emails, userEmail, t }) {
  const list = useMemo(() => cleanEmails(emails), [emails]);
  const [subject, setSubject] = useState(t.defaultSubject);
  const [body, setBody] = useState(t.defaultBody);
  const [idx, setIdx] = useState(0);
  const [copyState, setCopyState] = useState(null); // null | 'ok' | 'fail'

  const batches = useMemo(
    () => buildMailBatches(list, { subject, body, to: userEmail || '' }),
    [list, subject, body, userEmail],
  );

  if (!batches.length) return null;

  // Editar el mensaje puede achicar la cantidad de tandas: se acota el índice.
  const current = Math.min(idx, batches.length - 1);
  const batch = batches[current];

  const copyAll = async () => {
    const text = list.join(', ');
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try { // Fallback para contextos sin Clipboard API (http, iframes, navegadores viejos)
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    setCopyState(ok ? 'ok' : 'fail');
    setTimeout(() => setCopyState(null), 2500);
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-white font-semibold text-sm">{t.title}</h3>
        <p className="text-gray-500 text-xs mt-1">{t.hint(list.length)}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">{t.subjectLabel}</label>
          <input
            type="text" value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">{t.bodyLabel}</label>
          <textarea
            rows={7} value={body} onChange={e => setBody(e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm resize-y"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={batch.url}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          {t.writeBtn(current + 1, batches.length, batch.emails.length)}
        </a>
        {batches.length > 1 && (
          <button
            type="button"
            onClick={() => setIdx(Math.min(current + 1, batches.length - 1))}
            disabled={current >= batches.length - 1}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {t.nextBatch}
          </button>
        )}
        <button
          type="button" onClick={copyAll}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {copyState === 'ok' ? t.copied : copyState === 'fail' ? t.copyFailed : t.copyAll(list.length)}
        </button>
      </div>

      {batches.length > 1 && <p className="text-gray-600 text-[11px]">{t.batchNote}</p>}
    </div>
  );
}
