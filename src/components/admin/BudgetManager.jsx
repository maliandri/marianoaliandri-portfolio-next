'use client';

import { useState, useEffect, useMemo } from 'react';

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',  color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  reviewed: { label: 'Revisado',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  sent:     { label: 'Enviado',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  accepted: { label: 'Aceptado',   color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  rejected: { label: 'Rechazado',  color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

// Rango de "avance" de un presupuesto — se usa para decidir cuál sobrevive dentro de
// un grupo de duplicados: nunca borramos el que ya tiene más trabajo hecho (enviado,
// aceptado) a favor de uno que sigue en Pendiente sin tocar.
const STATUS_RANK = { rejected: 0, pending: 1, reviewed: 2, sent: 3, accepted: 4 };

// Clave de agrupación: mismo cliente (por email) + mismos servicios seleccionados.
// Dos solicitudes del mismo cliente con servicios distintos NO son duplicados, son
// pedidos legítimos distintos.
function dupKey(b) {
  const email = (b.clientEmail || '').trim().toLowerCase();
  const services = [...(b.selectedServices || [])].sort().join(',');
  return `${email}|${services}`;
}

function clientKey(b) {
  return (b.clientEmail || '').trim().toLowerCase() || `sin-email:${b.clientName}`;
}

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}

function BudgetDetail({ budget, onClose, onOpenInBuilder, onDelete }) {
  const [budgetUSD, setBudgetUSD] = useState(budget.budgetUSD || '');
  const [budgetARS, setBudgetARS] = useState(budget.budgetARS || '');
  const [adminNotes, setAdminNotes] = useState(budget.adminNotes || '');
  const [paymentDate, setPaymentDate] = useState(budget.paymentDate || '');
  const [paymentAmount, setPaymentAmount] = useState(budget.paymentAmount || '');
  const [savingPayment, setSavingPayment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingMP, setGeneratingMP] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [msg, setMsg] = useState('');

  const patch = async (updates) => {
    const res = await fetch('/api/presupuesto', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgetId: budget.id, ...updates }),
    });
    if (!res.ok) throw new Error('Error actualizando');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await patch({ budgetUSD: Number(budgetUSD) || null, budgetARS: Number(budgetARS) || null, adminNotes, status: 'reviewed' });
      setMsg('Guardado ✓');
    } catch { setMsg('Error al guardar'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const handleGenerateMP = async () => {
    if (!budgetARS) { setMsg('Ingresá el monto en ARS primero'); return; }
    setGeneratingMP(true);
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Presupuesto - ${budget.clientName}`,
          price: Number(budgetARS),
          quantity: 1,
          currency: 'ARS',
          description: `Servicios: ${(budget.selectedServices || []).join(', ')}`,
          external_reference: budget.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) throw new Error(data.error || 'Sin link');
      await patch({ paymentLink: data.init_point, status: 'sent' });
      budget.paymentLink = data.init_point;
      setMsg('Link generado ✓');
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setGeneratingMP(false); setTimeout(() => setMsg(''), 4000); }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'budget-sent',
          name: budget.clientName,
          email: budget.clientEmail,
          services: budget.selectedServices,
          budgetUSD,
          budgetARS,
          paymentLink: budget.paymentLink,
          adminNotes,
        }),
      });
      if (!res.ok) throw new Error('Error enviando email');
      await patch({ status: 'sent' });
      setMsg('Email enviado ✓');
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSendingEmail(false); setTimeout(() => setMsg(''), 3000); }
  };

  const handleWA = () => {
    const phone = budget.clientPhone?.replace(/[^0-9]/g, '') || '';
    const usd = budgetUSD ? `USD ${budgetUSD}` : '';
    const ars = budgetARS ? `ARS ${Number(budgetARS).toLocaleString('es-AR')}` : '';
    const link = budget.paymentLink ? `\nLink de pago: ${budget.paymentLink}` : '';
    const text = encodeURIComponent(`Hola ${budget.clientName}! Soy Mariano Aliandri. Te preparo el presupuesto para los servicios solicitados.\n${usd}${ars ? ' / ' + ars : ''}${link}`);
    window.open(`https://wa.me/${phone || '5492995414422'}?text=${text}`, '_blank');
  };

  const setStatus = async (status) => {
    try { await patch({ status }); budget.status = status; setMsg('Estado actualizado ✓'); }
    catch { setMsg('Error'); }
    setTimeout(() => setMsg(''), 2000);
  };

  const handleSavePayment = async () => {
    setSavingPayment(true);
    try {
      await patch({ paymentDate: paymentDate || null, paymentAmount: Number(paymentAmount) || null });
      budget.paymentDate = paymentDate; budget.paymentAmount = Number(paymentAmount) || null;
      setMsg('Pago guardado ✓');
    } catch { setMsg('Error al guardar el pago'); }
    finally { setSavingPayment(false); setTimeout(() => setMsg(''), 3000); }
  };

  const createdAt = budget.createdAt ? new Date(budget.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative h-full w-full max-w-xl bg-[#0f0f0f] border-l border-white/10 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#0f0f0f] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-white font-bold">{budget.clientName}</h3>
            <p className="text-gray-500 text-xs">{createdAt}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Datos cliente */}
          <section>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Datos del cliente</h4>
            <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Email:</span> <a href={`mailto:${budget.clientEmail}`} className="text-indigo-400">{budget.clientEmail}</a></p>
              {budget.clientPhone && <p><span className="text-gray-500">Tel:</span> <span className="text-white">{budget.clientPhone}</span></p>}
              {budget.clientCompany && <p><span className="text-gray-500">Empresa:</span> <span className="text-white">{budget.clientCompany}</span></p>}
              {budget.deadline && <p><span className="text-gray-500">Fecha límite:</span> <span className="text-white">{budget.deadline}</span></p>}
            </div>
          </section>

          {/* Descripción */}
          {budget.projectDescription && (
            <section>
              <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Descripción</h4>
              <div className="bg-[#111] border border-white/10 rounded-xl p-4 text-gray-300 text-sm leading-relaxed">
                {budget.projectDescription}
              </div>
            </section>
          )}

          {/* Servicios */}
          <section>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Servicios seleccionados ({(budget.selectedServices || []).length})</h4>
            <div className="flex flex-wrap gap-2">
              {(budget.selectedServices || []).map(s => (
                <span key={s} className="text-xs bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </section>

          {/* Presupuesto */}
          <section>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Monto</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-500 text-xs mb-1 block">USD</label>
                <input type="number" value={budgetUSD} onChange={e => setBudgetUSD(e.target.value)} placeholder="0" className="w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-indigo-500 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-gray-500 text-xs mb-1 block">ARS</label>
                <input type="number" value={budgetARS} onChange={e => setBudgetARS(e.target.value)} placeholder="0" className="w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-indigo-500 focus:outline-none text-sm" />
              </div>
            </div>
          </section>

          {/* Pago recibido — seguimiento manual, solo relevante una vez aceptado */}
          {budget.status === 'accepted' && (
            <section>
              <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">💵 Pago recibido</h4>
              <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Fecha de pago</label>
                    <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-indigo-500 focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Monto pagado (ARS)</label>
                    <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-indigo-500 focus:outline-none text-sm" />
                  </div>
                </div>
                <button onClick={handleSavePayment} disabled={savingPayment}
                  className="w-full bg-green-600/15 border border-green-500/40 hover:bg-green-600/25 text-green-300 py-2 rounded-xl text-sm transition-colors disabled:opacity-50">
                  {savingPayment ? 'Guardando...' : 'Guardar pago'}
                </button>
              </div>
            </section>
          )}

          {/* Notas */}
          <section>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Notas internas</h4>
            <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} placeholder="Visible solo para admin..." className="w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none text-sm resize-none" />
          </section>

          {/* Link MP */}
          {budget.paymentLink && (
            <section>
              <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Link de pago</h4>
              <a href={budget.paymentLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 text-sm break-all hover:underline">{budget.paymentLink}</a>
            </section>
          )}

          {/* Mensaje de estado */}
          {msg && <p className="text-center text-sm text-green-400">{msg}</p>}

          {/* Acciones */}
          <section className="space-y-3">
            {onOpenInBuilder && (
              <button
                onClick={() => { onClose(); onOpenInBuilder(budget); }}
                className="w-full bg-indigo-600/15 border border-indigo-500/40 hover:bg-indigo-600/25 text-indigo-300 py-2.5 rounded-xl text-sm transition-colors font-medium"
              >
                ✏️ Abrir en presupuestador
              </button>
            )}
            <button onClick={handleSave} disabled={saving} className="w-full bg-[#111] border border-white/10 hover:border-indigo-500 text-white py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
              {saving ? 'Guardando...' : '💾 Guardar cambios'}
            </button>
            <button onClick={handleGenerateMP} disabled={generatingMP} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
              {generatingMP ? 'Generando...' : '💳 Generar link MercadoPago'}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleSendEmail} disabled={sendingEmail} className="bg-[#111] border border-white/10 hover:border-indigo-500 text-white py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                {sendingEmail ? '...' : '📧 Enviar email'}
              </button>
              <button onClick={handleWA} className="bg-[#0d1f0d] border border-green-600/30 hover:border-green-500 text-green-400 py-2.5 rounded-xl text-sm transition-colors">
                💬 WhatsApp
              </button>
            </div>
            {onDelete && (
              <button
                onClick={() => { if (confirm('¿Eliminar esta solicitud de presupuesto? No se puede deshacer.')) { onDelete(budget.id); onClose(); } }}
                className="w-full text-red-400/70 hover:text-red-400 text-xs py-2 transition-colors"
              >
                🗑 Eliminar esta solicitud
              </button>
            )}
          </section>

          {/* Estado */}
          <section>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Estado</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setStatus(key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${budget.status === key ? cfg.color : 'border-white/10 text-gray-500 hover:border-white/25'}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ClientHistoryPanel({ client, onClose, onSelectBudget }) {
  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const sorted = [...client.budgets].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative h-full w-full max-w-xl bg-[#0f0f0f] border-l border-white/10 overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0f0f0f] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-white font-bold">{client.clientName}</h3>
            <p className="text-gray-500 text-xs">{client.clientEmail} · {sorted.length} solicitud{sorted.length !== 1 ? 'es' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-3">
          {sorted.map(b => (
            <button
              key={b.id}
              onClick={() => onSelectBudget(b)}
              className="w-full text-left bg-[#111] border border-white/10 hover:border-indigo-500/50 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-medium">{formatDate(b.createdAt)}</span>
                <StatusBadge status={b.status} />
              </div>
              <p className="text-gray-400 text-xs">{(b.selectedServices || []).length} servicios seleccionados</p>
              {b.projectDescription && <p className="text-gray-600 text-xs mt-1 truncate">{b.projectDescription}</p>}
              {(b.budgetUSD || b.budgetARS) && (
                <p className="text-indigo-400 text-xs mt-1.5 font-medium">
                  {b.budgetUSD ? `USD ${b.budgetUSD}` : ''}{b.budgetUSD && b.budgetARS ? ' / ' : ''}{b.budgetARS ? `ARS ${Number(b.budgetARS).toLocaleString('es-AR')}` : ''}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BudgetManager({ onOpenInBuilder }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'byClient'
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [deletingIds, setDeletingIds] = useState(new Set());

  const loadBudgets = () => {
    setLoading(true);
    fetch('/api/presupuesto')
      .then(r => r.json())
      .then(data => setBudgets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBudgets(); }, []);

  // Grupos de duplicados: mismo cliente + mismos servicios, más de una solicitud.
  // Dentro de cada grupo, "sobrevive" el de mayor avance (o el más reciente si empatan).
  const duplicateGroups = useMemo(() => {
    const byKey = new Map();
    budgets.forEach(b => {
      const k = dupKey(b);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(b);
    });
    return [...byKey.values()]
      .filter(group => group.length > 1)
      .map(group => {
        const sorted = [...group].sort((a, b) => {
          const rankDiff = (STATUS_RANK[b.status] ?? 1) - (STATUS_RANK[a.status] ?? 1);
          if (rankDiff !== 0) return rankDiff;
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        return { keep: sorted[0], remove: sorted.slice(1) };
      });
  }, [budgets]);
  const duplicateCount = duplicateGroups.reduce((sum, g) => sum + g.remove.length, 0);

  // Agrupación por cliente para la vista "Por cliente" — un cliente puede pedir
  // presupuesto varias veces, esto junta todas sus solicitudes en una fila.
  const clients = useMemo(() => {
    const byKey = new Map();
    budgets.forEach(b => {
      const k = clientKey(b);
      if (!byKey.has(k)) byKey.set(k, { clientName: b.clientName, clientEmail: b.clientEmail, clientPhone: b.clientPhone, budgets: [] });
      byKey.get(k).budgets.push(b);
    });
    return [...byKey.values()].sort((a, b) => {
      const aLatest = Math.max(...a.budgets.map(x => new Date(x.createdAt || 0).getTime()));
      const bLatest = Math.max(...b.budgets.map(x => new Date(x.createdAt || 0).getTime()));
      return bLatest - aLatest;
    });
  }, [budgets]);

  const deleteBudget = async (id) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/presupuesto?id=${id}`, { method: 'DELETE' });
      setBudgets(prev => prev.filter(b => b.id !== id));
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const deleteAllDuplicates = async () => {
    const idsToRemove = duplicateGroups.flatMap(g => g.remove.map(b => b.id));
    if (!idsToRemove.length) return;
    if (!confirm(`Se van a eliminar ${idsToRemove.length} solicitud${idsToRemove.length !== 1 ? 'es' : ''} duplicada${idsToRemove.length !== 1 ? 's' : ''}. Se conserva la de mayor avance (o la más reciente) de cada grupo. ¿Continuar?`)) return;
    setDeletingIds(prev => new Set([...prev, ...idsToRemove]));
    await Promise.all(idsToRemove.map(id => fetch(`/api/presupuesto?id=${id}`, { method: 'DELETE' })));
    setBudgets(prev => prev.filter(b => !idsToRemove.includes(b.id)));
    setDeletingIds(new Set());
    setShowDuplicates(false);
  };

  const filtered = filter === 'all' ? budgets : budgets.filter(b => b.status === filter);
  const showPaymentCols = filter === 'accepted';
  const totalPaid = filtered.reduce((sum, b) => sum + (Number(b.paymentAmount) || 0), 0);

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const formatPaymentDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">💰 Presupuestos</h2>
          <p className="text-xs text-gray-500 mt-0.5">{budgets.length} solicitud{budgets.length !== 1 ? 'es' : ''} recibida{budgets.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {duplicateCount > 0 && (
            <button
              onClick={() => setShowDuplicates(true)}
              className="text-xs px-3 py-1.5 rounded-full border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors font-medium"
            >
              🧹 {duplicateCount} duplicado{duplicateCount !== 1 ? 's' : ''}
            </button>
          )}
          <a href="/presupuesto" target="_blank" className="text-xs text-indigo-400 hover:underline">Ver formulario público →</a>
        </div>
      </div>

      {/* Vista: flat vs. agrupado por cliente */}
      <div className="flex gap-2">
        {[['all', 'Todas las solicitudes'], ['byClient', 'Por cliente']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setViewMode(k)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${viewMode === k ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10' : 'border-white/10 text-gray-500 hover:border-white/25'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros por estado — solo aplican a la vista flat */}
      {viewMode === 'all' && (
        <div className="flex gap-2 flex-wrap">
          {[['all', 'Todos'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === k ? 'border-indigo-500 text-indigo-300 bg-indigo-600/10' : 'border-white/10 text-gray-400 hover:border-white/25 dark:border-gray-600'}`}
            >
              {label} {k !== 'all' && budgets.filter(b => b.status === k).length > 0 && `(${budgets.filter(b => b.status === k).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Total pagado — solo tiene sentido mirando "Aceptado" */}
      {viewMode === 'all' && showPaymentCols && !loading && filtered.length > 0 && (
        <div className="bg-green-600/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-green-300 text-sm font-medium">💵 Total pagado</span>
          <span className="text-white font-bold">ARS {totalPaid.toLocaleString('es-AR')}</span>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === 'byClient' ? (
        clients.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📭</p>
            <p>No hay solicitudes todavía</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 pr-4">Cliente</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Solicitudes</th>
                  <th className="pb-3 pr-4">Último estado</th>
                  <th className="pb-3">Última fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {clients.map(c => {
                  const sorted = [...c.budgets].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                  const latest = sorted[0];
                  return (
                    <tr
                      key={clientKey(latest)}
                      onClick={() => setSelectedClient(c)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900 dark:text-white">{c.clientName}</p>
                        {latest.clientCompany && <p className="text-xs text-gray-400">{latest.clientCompany}</p>}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{c.clientEmail}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.budgets.length > 1 ? 'bg-indigo-500/15 text-indigo-300' : 'text-gray-500'}`}>
                          {c.budgets.length}
                        </span>
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={latest.status} /></td>
                      <td className="py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(latest.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>No hay solicitudes {filter !== 'all' ? `con estado "${STATUS_CONFIG[filter]?.label}"` : 'todavía'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 pr-4">Cliente</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Servicios</th>
                <th className="pb-3 pr-4">Estado</th>
                <th className="pb-3 pr-4">Fecha</th>
                {showPaymentCols && <th className="pb-3 pr-4">Fecha de pago</th>}
                {showPaymentCols && <th className="pb-3">Monto pagado</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(b => (
                <tr
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900 dark:text-white">{b.clientName}</p>
                    {b.clientCompany && <p className="text-xs text-gray-400">{b.clientCompany}</p>}
                  </td>
                  <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{b.clientEmail}</td>
                  <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{(b.selectedServices || []).length} servicios</td>
                  <td className="py-3 pr-4"><StatusBadge status={b.status} /></td>
                  <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(b.createdAt)}</td>
                  {showPaymentCols && <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">{formatPaymentDate(b.paymentDate)}</td>}
                  {showPaymentCols && <td className="py-3 text-gray-300 text-xs whitespace-nowrap">{b.paymentAmount ? `ARS ${Number(b.paymentAmount).toLocaleString('es-AR')}` : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <BudgetDetail budget={selected} onClose={() => setSelected(null)} onOpenInBuilder={onOpenInBuilder} onDelete={deleteBudget} />}

      {selectedClient && (
        <ClientHistoryPanel
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSelectBudget={(b) => { setSelectedClient(null); setSelected(b); }}
        />
      )}

      {/* Panel de confirmación de duplicados */}
      {showDuplicates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDuplicates(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0f0f0f] border border-white/10 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">🧹 Solicitudes duplicadas</h3>
              <button onClick={() => setShowDuplicates(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-gray-500 text-sm mb-5">
              Mismo cliente + mismos servicios seleccionados. En cada grupo se conserva la de mayor
              avance (o la más reciente, si están todas en el mismo estado) y se eliminan las demás.
            </p>
            <div className="space-y-4 mb-6">
              {duplicateGroups.map((g, i) => (
                <div key={i} className="bg-[#111] border border-white/10 rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-2">{g.keep.clientName} · {g.keep.clientEmail}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">✓ Se conserva</span>
                    <span className="text-white text-xs">{formatDate(g.keep.createdAt)}</span>
                    <StatusBadge status={g.keep.status} />
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {g.remove.map(b => (
                      <div key={b.id} className="flex items-center gap-2 text-xs">
                        <span className="text-red-400">🗑 Se elimina</span>
                        <span className="text-gray-500">{formatDate(b.createdAt)}</span>
                        <StatusBadge status={b.status} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDuplicates(false)} className="flex-1 border border-white/10 hover:border-white/25 text-white py-2.5 rounded-xl text-sm transition-colors">
                Cancelar
              </button>
              <button
                onClick={deleteAllDuplicates}
                disabled={deletingIds.size > 0}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {deletingIds.size > 0 ? 'Eliminando...' : `Eliminar ${duplicateCount} duplicado${duplicateCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
