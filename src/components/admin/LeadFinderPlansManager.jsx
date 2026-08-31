'use client';

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';

const SCOPE_LABEL = {
  localidad: { label: '📍 Localidad', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' },
  provincia: { label: '🗺️ Provincia', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  pais:      { label: '🇦🇷 País',     className: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

const BILLING_LABEL = {
  subscription: 'Suscripción mensual',
  project: 'Pago único (por proyecto)',
};

const EMPTY_PLAN = {
  name: '', scope: 'localidad', billingType: 'subscription',
  priceARS: 0, credits: 0, description: '', active: true, order: 99,
};

function getAdminPassword() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '';
}

function fmtARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
}

function PlanForm({ initial, onCancel, onSave, saving }) {
  const [form, setForm] = useState(initial);
  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="p-5 space-y-4 border-t border-gray-100 dark:border-neutral-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Nombre</label>
          <input
            type="text" value={form.name} onChange={e => setField('name', e.target.value)}
            placeholder="Ej: Ciudad Pro"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Alcance</label>
          <select
            value={form.scope} onChange={e => setField('scope', e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="localidad">Localidad</option>
            <option value="provincia">Provincia</option>
            <option value="pais">País completo</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Facturación</label>
          <select
            value={form.billingType} onChange={e => setField('billingType', e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="subscription">Suscripción mensual</option>
            <option value="project">Pago único (proyecto)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Precio (ARS)</label>
          <input
            type="number" min={0} value={form.priceARS} onChange={e => setField('priceARS', e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Auditorías / créditos</label>
          <input
            type="number" min={0} value={form.credits} onChange={e => setField('credits', e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Descripción</label>
        <textarea
          rows={2} value={form.description} onChange={e => setField('description', e.target.value)}
          placeholder="Qué incluye este plan, para quién es..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Orden</label>
          <input
            type="number" min={0} value={form.order} onChange={e => setField('order', e.target.value)}
            className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-4">
          <input type="checkbox" checked={form.active} onChange={e => setField('active', e.target.checked)} className="w-4 h-4 rounded" />
          Activo (visible para clientes)
        </label>
        <div className="ml-auto mt-4 flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const LeadFinderPlansManager = forwardRef(function LeadFinderPlansManager(_props, ref) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null); // id del plan en edición, o 'new'
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/leadfinder-plans?all=1')
      .then(r => r.json())
      .then(data => setPlans(data.plans || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useImperativeHandle(ref, () => ({ reload: load, getPlans: () => plans }));

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const adminPassword = getAdminPassword();
      const isNew = editingId === 'new';
      const res = await fetch('/api/leadfinder-plans', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? { adminPassword, plan: form } : { adminPassword, id: editingId, plan: form }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error guardando');
      setEditingId(null);
      load();
    } catch (e) {
      alert('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan) => {
    if (!confirm(`¿Eliminar el plan "${plan.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const adminPassword = getAdminPassword();
      const res = await fetch(`/api/leadfinder-plans?id=${plan.id}&adminPassword=${encodeURIComponent(adminPassword)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error eliminando');
      load();
    } catch (e) {
      alert('❌ ' + e.message);
    }
  };

  const toggleActive = async (plan) => {
    try {
      const adminPassword = getAdminPassword();
      await fetch('/api/leadfinder-plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, id: plan.id, plan: { ...plan, active: !plan.active } }),
      });
      load();
    } catch (e) {
      alert('❌ ' + e.message);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Planes — Lead Finder Pro</h3>
          <p className="text-xs text-gray-500 mt-0.5">{plans.length} planes · créditos y precios editables sin redeploy</p>
        </div>
        <button
          onClick={() => setEditingId('new')}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          + Nuevo plan
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {editingId === 'new' && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-indigo-300 dark:border-indigo-500/40 overflow-hidden">
          <p className="px-5 pt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Nuevo plan</p>
          <PlanForm initial={EMPTY_PLAN} saving={saving} onCancel={() => setEditingId(null)} onSave={handleSave} />
        </div>
      )}

      {plans.map(plan => {
        const isEditing = editingId === plan.id;
        const scope = SCOPE_LABEL[plan.scope] || SCOPE_LABEL.localidad;
        return (
          <div key={plan.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="w-full flex items-center justify-between px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${scope.className}`}>{scope.label}</span>
                  {!plan.active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400">Inactivo</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {fmtARS(plan.priceARS)} · {plan.credits?.toLocaleString('es-AR')} auditorías · {BILLING_LABEL[plan.billingType] || plan.billingType}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(plan)}
                  title={plan.active ? 'Desactivar' : 'Activar'}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {plan.active ? '👁️' : '🚫'}
                </button>
                <button
                  onClick={() => setEditingId(isEditing ? null : plan.id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {isEditing ? 'Cerrar' : 'Editar'}
                </button>
                <button
                  onClick={() => handleDelete(plan)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
            {isEditing && (
              <PlanForm initial={plan} saving={saving} onCancel={() => setEditingId(null)} onSave={handleSave} />
            )}
          </div>
        );
      })}

      {plans.length === 0 && !error && (
        <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
          No hay planes cargados todavía. Creá el primero con "+ Nuevo plan".
        </div>
      )}
    </div>
  );
});

export default LeadFinderPlansManager;
