'use client';

import { useState, useEffect } from 'react';

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',  color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  reviewed: { label: 'Revisado',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  sent:     { label: 'Enviado',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  accepted: { label: 'Aceptado',   color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  rejected: { label: 'Rechazado',  color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}

function BudgetDetail({ budget, onClose, onOpenInBuilder }) {
  const [budgetUSD, setBudgetUSD] = useState(budget.budgetUSD || '');
  const [budgetARS, setBudgetARS] = useState(budget.budgetARS || '');
  const [adminNotes, setAdminNotes] = useState(budget.adminNotes || '');
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

export default function BudgetManager({ onOpenInBuilder }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/presupuesto')
      .then(r => r.json())
      .then(data => setBudgets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? budgets : budgets.filter(b => b.status === filter);

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">💰 Presupuestos</h2>
          <p className="text-xs text-gray-500 mt-0.5">{budgets.length} solicitud{budgets.length !== 1 ? 'es' : ''} recibida{budgets.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="/presupuesto" target="_blank" className="text-xs text-indigo-400 hover:underline">Ver formulario público →</a>
      </div>

      {/* Filtros */}
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

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
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
                <th className="pb-3">Fecha</th>
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
                  <td className="py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <BudgetDetail budget={selected} onClose={() => setSelected(null)} onOpenInBuilder={onOpenInBuilder} />}
    </div>
  );
}
