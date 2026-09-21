'use client';

import { useState, useEffect, useCallback } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_STYLE = {
  sent:      { label: 'Enviado',    cls: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-300' },
  delivered: { label: 'Entregado',  cls: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  opened:    { label: 'Abierto',    cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' },
  clicked:   { label: 'Click',      cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' },
  bounced:   { label: 'Rebotado',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  complained:{ label: 'Spam',       cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.sent;
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

export default function SentEmailsManager() {
  const [emails, setEmails]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [viewing, setViewing] = useState(null);   // doc a mostrar en el modal
  const [busy, setBusy]       = useState(null);    // id en acción (reenviar/eliminar)
  const [toast, setToast]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/sent-emails');
      const data = await res.json();
      setEmails(Array.isArray(data) ? data : []);
    } catch { setEmails([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleResend = async (m) => {
    if (!confirm(`¿Reenviar el email a ${m.email}?`)) return;
    setBusy(m.id);
    try {
      const resp = await fetch('/api/auditorias/send-biz-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: m.nombre, siteUrl: m.siteUrl, email: m.email,
          seoScore: m.seoScore, ciudad: m.ciudad, tipo: m.tipo,
          auditoriaId: m.auditoriaId,
          emailText: m.body, screenshotUrl: m.screenshotUrl,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al reenviar');
      flash('Reenviado');
      load();
    } catch (e) {
      flash('✗ ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleReuse = async (m) => {
    try {
      await navigator.clipboard.writeText(m.body || '');
      flash('✓ Texto copiado al portapapeles');
    } catch {
      flash('No se pudo copiar');
    }
  };

  const handleDelete = async (m) => {
    if (!confirm(`¿Eliminar el registro del email a ${m.email}?`)) return;
    setBusy(m.id);
    try {
      await fetch('/api/sent-emails', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id }),
      });
      setEmails(prev => prev.filter(x => x.id !== m.id));
    } catch (e) {
      flash('✗ ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  const filtered = emails.filter(m => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return [m.nombre, m.email, m.ciudad, m.tipo].some(v => (v || '').toLowerCase().includes(t));
  });

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-500"><span className="animate-pulse">Cargando emails…</span></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Emails enviados</h2>
          <p className="text-sm text-gray-500 mt-0.5">{emails.length} envío{emails.length !== 1 ? 's' : ''} registrado{emails.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar negocio, email, ciudad…"
            className="px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          />
          <button onClick={load}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
            Recargar
          </button>
        </div>
      </div>

      {toast && (
        <div className="text-sm px-4 py-2 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 inline-block">{toast}</div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
                    <p>{emails.length === 0 ? 'Todavía no enviaste ningún email.' : 'Sin resultados para la búsqueda.'}</p>
          {emails.length === 0 && <p className="text-xs mt-1">Enviá uno desde Auditorías, con el botón Generar.</p>}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/40 text-left">
                <tr className="border-b border-gray-200 dark:border-neutral-800">
                  {['Negocio', 'Email', 'Estado', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/60">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900 dark:text-white max-w-[180px] truncate" title={m.nombre}>{m.nombre}</div>
                      {m.ciudad && <div className="text-xs text-gray-400">{m.ciudad}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 max-w-[160px] truncate" title={m.email}>{m.email}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setViewing(m)}
                          className="px-2.5 py-1 text-xs border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">Ver</button>
                        <button onClick={() => handleResend(m)} disabled={busy === m.id}
                          className="px-2.5 py-1 text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-40">
                          {busy === m.id ? '…' : 'Reenviar'}</button>
                        <button onClick={() => handleReuse(m)}
                          className="px-2.5 py-1 text-xs border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">Copiar</button>
                        <button onClick={() => handleDelete(m)} disabled={busy === m.id}
                          className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ver */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{viewing.subject}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Para <strong>{viewing.nombre}</strong> · {viewing.email} · {formatDate(viewing.createdAt)}</p>
              </div>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-neutral-800 rounded-xl p-3">{viewing.body}</pre>
            {viewing.screenshotUrl && (
              <img src={viewing.screenshotUrl} alt="" className="w-full rounded-xl border border-gray-200 dark:border-neutral-800 mt-3" />
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => handleReuse(viewing)} className="px-3 py-2 text-sm border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">Copiar texto</button>
              <button onClick={() => { handleResend(viewing); setViewing(null); }} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Reenviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
