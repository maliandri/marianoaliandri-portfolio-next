'use client';

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';

function getAdminPassword() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '';
}
function fmtARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
}

const AnaliticaPlansEditor = forwardRef(function AnaliticaPlansEditor(_props, ref) {
  const [plans, setPlans] = useState(null);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(null);

  const load = () =>
    fetch('/api/analitica-plans')
      .then(r => r.json())
      .then(data => {
        setPlans(data.plans || []);
        const initial = {};
        (data.plans || []).forEach(p => { initial[p.id] = { price: p.price, limit: p.limit ?? '' }; });
        setEdits(initial);
      })
      .catch(() => setPlans([]));

  useEffect(() => { load(); }, []);
  useImperativeHandle(ref, () => ({ reload: load, getPlans: () => plans || [] }));

  const setField = (id, field, value) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const save = async (id) => {
    setSaving(id);
    try {
      const adminPassword = getAdminPassword();
      const e = edits[id];
      const res = await fetch('/api/analitica-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, id, price: e.price, limit: e.limit === '' ? null : e.limit }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      load();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(null);
    }
  };

  if (!plans) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">Solo precio y cuota son editables — los ids (free/básico/full) son fijos, los usa MercadoPago para matchear la suscripción.</p>
      {plans.map(p => {
        const e = edits[p.id] || { price: p.price, limit: p.limit ?? '' };
        return (
          <div key={p.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5 flex flex-wrap items-center gap-4">
            <div className="min-w-[100px]">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{fmtARS(p.price)}{p.period === 'month' ? '/mes' : ''}</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Precio ARS</label>
              <input type="number" min={0} value={e.price} onChange={ev => setField(p.id, 'price', Number(ev.target.value))}
                className="w-28 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Búsquedas (vacío = ilimitado)</label>
              <input type="number" min={0} value={e.limit} onChange={ev => setField(p.id, 'limit', ev.target.value === '' ? '' : Number(ev.target.value))}
                placeholder="∞"
                className="w-32 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm" />
            </div>
            <button onClick={() => save(p.id)} disabled={saving === p.id}
              className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving === p.id ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default AnaliticaPlansEditor;
