'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/utils/adminFetch';
import SendAuditEmailButton from '@/components/admin/SendAuditEmailButton';

// Mails desde el Lead Finder del ADMIN (2026-11-26): al unificar el buscador, el admin había quedado con el panel
// de Lead Finder Pro (mailto con CCO para pegar en tu correo). Acá vuelve el envío por Resend, el mismo de
// Auditorías: botón "✉ Enviar" por negocio (texto de Gemini editable antes de mandar) y "Enviar a todos" a los que
// todavía no recibieron. Si el informe de esta búsqueda ya se publicó, cada mail lleva el link a su auditoría.

// email (minúsculas) → { count, lastSentAt }, de sent_emails.
export function useEmailCounts(activo = true) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (!activo) return;
    adminFetch('/api/auditorias/email-counts')
      .then(r => (r.ok ? r.json() : {}))
      .then(d => setCounts(d && typeof d === 'object' && !d.error ? d : {}))
      .catch(() => {});
  }, [activo]);
  const bump = useCallback((email) => {
    if (!email) return;
    const k = email.toLowerCase();
    setCounts(prev => ({ ...prev, [k]: { count: (prev[k]?.count || 0) + 1, lastSentAt: new Date().toISOString() } }));
  }, []);
  return { counts, bump };
}

const sePuedeMandar = (neg) => !!(neg.email && neg.siteUrl);
const enviados = (counts, email) => counts[(email || '').toLowerCase()]?.count || 0;

// Botón por fila (columna "Mail" de la tabla).
export function LeadMailButton({ neg, auditoriaId, counts, onSent }) {
  if (!sePuedeMandar(neg)) return <span className="text-fg-600 text-xs">—</span>;
  const k = (neg.email || '').toLowerCase();
  return (
    <SendAuditEmailButton
      key={`${neg.id}-${auditoriaId || ''}`}
      neg={neg}
      auditoriaId={auditoriaId || null}
      sentCount={counts[k]?.count || 0}
      lastSentAt={counts[k]?.lastSentAt || null}
      onSent={onSent}
    />
  );
}

// Panel de arriba de la tabla: resumen + "Enviar a todos los que no recibieron".
export function LeadMailBulk({ leads, auditoriaId, counts, onSent }) {
  const [bulk, setBulk] = useState(null); // { total, done, ok, fail, current, running, log }
  const conMail = leads.filter(sePuedeMandar);
  const pendientes = conMail.filter(n => enviados(counts, n.email) === 0);
  if (!conMail.length) return null;

  const mandarTodos = async () => {
    if (!pendientes.length) return;
    if (!confirm(`¿Mandar el mail de análisis a ${pendientes.length} negocio${pendientes.length === 1 ? '' : 's'} por Resend?\nCada uno se redacta con Gemini y se manda por separado. Los que pidieron la baja o rebotaron se saltean solos.`)) return;
    setBulk({ total: pendientes.length, done: 0, ok: 0, fail: 0, current: '', running: true, log: [] });
    let ok = 0, fail = 0;
    for (let i = 0; i < pendientes.length; i++) {
      const neg = pendientes[i];
      setBulk(b => ({ ...b, current: neg.nombre, done: i }));
      try {
        const resp = await adminFetch('/api/auditorias/send-biz-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auditoriaId: auditoriaId || null, negocioId: neg.id,
            nombre: neg.nombre, siteUrl: neg.siteUrl, email: neg.email,
            seoScore: neg.seoScore, hasSitemap: neg.hasSitemap, hasRobots: neg.hasRobots,
            metaDesc: neg.metaDesc, hasOG: neg.hasOG, ciudad: neg.ciudad, tipo: neg.tipo,
            anuncios: neg.anuncios ?? null, plataforma: neg.plataforma ?? null,
          }),
        });
        const d = await resp.json().catch(() => ({}));
        if (!resp.ok || d.error) throw new Error(d.error || `HTTP ${resp.status}`);
        ok++;
        onSent(neg.email);
        setBulk(b => ({ ...b, ok, log: [...b.log, { nombre: neg.nombre, ok: true }] }));
      } catch (e) {
        fail++;
        setBulk(b => ({ ...b, fail, log: [...b.log, { nombre: neg.nombre, email: neg.email, ok: false, err: e.message }] }));
      }
    }
    setBulk(b => ({ ...b, done: pendientes.length, current: '', running: false }));
  };

  return (
    <div className="bg-card border border-fg/10 rounded-2xl px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-fg font-semibold text-sm">✉️ Mails por Resend</h3>
          <p className="text-fg-500 text-xs mt-1 max-w-2xl">
            {conMail.length} negocio{conMail.length === 1 ? '' : 's'} con mail y web · {conMail.length - pendientes.length} ya recibieron.
            Usá <strong>✉ Enviar</strong> en cada fila para ver y editar el texto antes de mandarlo.
            {auditoriaId
              ? ' El informe de esta búsqueda ya está publicado: cada mail lleva el link a su auditoría personal.'
              : ' Tip: si primero tocás "Publicar informe", cada mail sale con el link a la auditoría personal del negocio.'}
          </p>
        </div>
        <button onClick={mandarTodos} disabled={bulk?.running || pendientes.length === 0}
          className="shrink-0 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {bulk?.running ? `Enviando… ${bulk.done}/${bulk.total}` : pendientes.length ? `Enviar a todos los que no recibieron (${pendientes.length})` : 'Todos recibieron'}
        </button>
      </div>
      {bulk && (
        <div>
          <div className="h-1.5 w-full bg-fg/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${bulk.total ? Math.round((bulk.done / bulk.total) * 100) : 0}%` }} />
          </div>
          <p className="text-[11px] text-fg-500 mt-1.5" aria-live="polite">
            {bulk.running
              ? <>Enviando a <strong>{bulk.current}</strong>… ({bulk.done}/{bulk.total})</>
              : <>Listo: <strong className="text-emerald-600">{bulk.ok} enviados</strong>{bulk.fail > 0 && <>, <strong className="text-red-500">{bulk.fail} sin enviar</strong></>}.</>}
          </p>
          {!bulk.running && bulk.log.some(l => !l.ok) && (
            <ul className="mt-1 space-y-0.5">
              {bulk.log.filter(l => !l.ok).map((l, i) => (
                <li key={i} className="text-[11px] text-red-500 truncate" title={l.err}>✗ {l.nombre} ({l.email}): {l.err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
