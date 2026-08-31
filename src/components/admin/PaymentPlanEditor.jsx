'use client';

import React, { useState, useEffect } from 'react';
import { DEFAULT_PAYMENT_PLAN, sanitizePlan } from '@/data/paymentPlan';

// Editor del plan de pago de la tienda (seña + hitos). Persiste en Firestore
// via /api/payment-plan. El primer hito es la seña (lo único que se cobra online).
export default function PaymentPlanEditor() {
  const [milestones, setMilestones] = useState(DEFAULT_PAYMENT_PLAN.milestones);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/payment-plan')
      .then((r) => r.json())
      .then((d) => { if (d?.plan) setMilestones(sanitizePlan(d.plan).milestones); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = milestones.reduce((s, m) => s + (Number(m.pct) || 0), 0);

  const updateMilestone = (i, field, value) => {
    setMilestones((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  };
  const addMilestone = () => setMilestones((prev) => [...prev, { label: 'Nuevo hito', pct: 0 }]);
  const removeMilestone = (i) => setMilestones((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/payment-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: sessionStorage.getItem('adminPassword'),
          plan: { milestones },
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Error');
      setMilestones(sanitizePlan(d.plan).milestones);
      setMsg('✓ Guardado');
    } catch (e) {
      setMsg('✕ ' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  if (loading) return null;

  return (
    <div className="mb-6 bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Plan de pago de la tienda</h3>
        <span className={`text-sm font-semibold ${total === 100 ? 'text-green-600' : 'text-orange-500'}`}>
          Suma: {total}%
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        El <strong>primer hito</strong> es la seña — lo único que se cobra online por MercadoPago.
        El resto se coordina aparte. La suma debería dar 100%.
      </p>

      <div className="space-y-2">
        {milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16">{i === 0 ? 'Seña' : `Hito ${i + 1}`}</span>
            <input
              type="text"
              value={m.label}
              onChange={(e) => updateMilestone(i, 'label', e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white"
              placeholder="Etiqueta"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                value={m.pct}
                onChange={(e) => updateMilestone(i, 'pct', Number(e.target.value))}
                className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <button
              onClick={() => removeMilestone(i)}
              disabled={milestones.length <= 1}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30"
              title="Eliminar hito"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={addMilestone}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          + Agregar hito
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
        >
          {saving ? 'Guardando…' : 'Guardar plan'}
        </button>
        {msg && <span className="text-sm text-gray-600 dark:text-gray-300">{msg}</span>}
      </div>
    </div>
  );
}
