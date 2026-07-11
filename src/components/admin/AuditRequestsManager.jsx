'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_CONFIG = {
  pending:     { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700' },
  in_progress: { label: 'En proceso',  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
  done:        { label: 'Completada',  color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700' },
  rejected:    { label: 'Descartada', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function RequestRow({ req, onStatusChange, onExpand, expanded }) {
  const [updating, setUpdating] = useState(false);

  const changeStatus = async (newStatus) => {
    setUpdating(true);
    await onStatusChange(req.id, newStatus);
    setUpdating(false);
  };

  const waUrl = `https://wa.me/${req.telefono?.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hola ${req.nombre?.split(' ')[0]}, te contactamos por tu solicitud de auditoría SEO para "${req.searchTerm}" en ${req.localidad}, ${req.provincia}. 🔍`
  )}`;

  return (
    <>
      <tr
        onClick={onExpand}
        className={`cursor-pointer transition-colors ${expanded ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/50'}`}
      >
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(req.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900 dark:text-white text-sm">{req.nombre}</div>
          <div className="text-xs text-gray-500">{req.email}</div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{req.telefono}</td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{req.searchTerm}</div>
          <div className="text-xs text-gray-500">{req.localidad}, {req.provincia}</div>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={req.status} />
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs">{expanded ? '▲' : '▼'}</td>
      </tr>

      {expanded && (
        <tr className="bg-indigo-50/50 dark:bg-indigo-900/5">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Datos completos */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">Datos de contacto</p>
                <Field label="Nombre"   value={req.nombre} />
                <Field label="Email"    value={req.email} copyable />
                <Field label="Teléfono" value={req.telefono} copyable />
                {req.sitioWeb && <Field label="Sitio web" value={req.sitioWeb} link />}
                <Field label="Rubro"    value={req.searchTerm} />
                <Field label="Ciudad"   value={`${req.localidad}, ${req.provincia}`} />
                <Field label="ID"       value={req.id} copyable muted />
              </div>

              {/* Acciones */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">Acciones</p>

                {/* WhatsApp */}
                <a
                  href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <span>💬</span> Contactar por WhatsApp
                </a>

                {/* Email */}
                <a
                  href={`mailto:${req.email}?subject=Tu solicitud de auditoría SEO — ${req.searchTerm}&body=Hola ${req.nombre?.split(' ')[0]},`}
                  className="flex items-center gap-2 w-full bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <span>✉️</span> Enviar email
                </a>

                {/* Cambiar estado */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Cambiar estado:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        disabled={updating || req.status === key}
                        onClick={e => { e.stopPropagation(); changeStatus(key); }}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40 ${
                          req.status === key
                            ? cfg.color + ' cursor-default'
                            : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value, copyable, link, muted }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 min-w-[80px] shrink-0">{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline truncate" onClick={e => e.stopPropagation()}>{value}</a>
      ) : (
        <span className={muted ? 'text-gray-500 font-mono text-xs' : 'text-gray-900 dark:text-gray-100 font-medium'}>{value || '—'}</span>
      )}
      {copyable && (
        <button onClick={copy} className="text-xs text-gray-400 hover:text-indigo-400 shrink-0 transition-colors">
          {copied ? '✓' : '⎘'}
        </button>
      )}
    </div>
  );
}

export default function AuditRequestsManager() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState(null);
  const [filter,   setFilter]   = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/audit-request');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequests(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, status) => {
    await fetch('/api/audit-request', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const counts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">🔍 Solicitudes de auditoría SEO</h2>
          <p className="text-sm text-gray-500 mt-0.5">{requests.length} solicitudes en total</p>
        </div>
        <button onClick={load} className="text-sm text-indigo-500 hover:text-indigo-400 transition-colors">
          ↻ Actualizar
        </button>
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400'}`}
        >
          Todas ({requests.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === key ? cfg.color : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400'}`}
          >
            {cfg.label} {counts[key] ? `(${counts[key]})` : '(0)'}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm">{filter === 'all' ? 'No hay solicitudes todavía.' : 'No hay solicitudes con este estado.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800/60">
              <tr>
                {['Fecha', 'Contacto', 'Teléfono', 'Rubro / Ciudad', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-neutral-900">
              {filtered.map(req => (
                <RequestRow
                  key={req.id}
                  req={req}
                  onStatusChange={handleStatusChange}
                  expanded={expanded === req.id}
                  onExpand={() => setExpanded(expanded === req.id ? null : req.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
