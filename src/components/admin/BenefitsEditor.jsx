'use client';

import { useState, useEffect, useRef } from 'react';
import { SERVICES } from '../../data/serviceCatalog';

export default function BenefitsEditor() {
  /* dbBenefits: { [id]: string } — cargado desde Firestore */
  const [dbBenefits, setDbBenefits] = useState(null);
  /* drafts: { [id]: string } — edición local sin guardar */
  const [drafts, setDrafts] = useState({});
  /* savingId: id del servicio que se está guardando */
  const [savingId, setSavingId] = useState(null);
  /* msgs: { [id]: { text, ok } } */
  const [msgs, setMsgs] = useState({});
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/service-benefits')
      .then(r => r.json())
      .then(data => { setDbBenefits(data); setLoading(false); })
      .catch(() => { setDbBenefits({}); setLoading(false); });
  }, []);

  const effectiveBenefit = (svc) =>
    drafts[svc.id] !== undefined ? drafts[svc.id]
    : dbBenefits?.[svc.id] !== undefined ? dbBenefits[svc.id]
    : svc.benefit;

  const isDirty = (svc) => {
    const draft = drafts[svc.id];
    if (draft === undefined) return false;
    const saved = dbBenefits?.[svc.id] ?? svc.benefit;
    return draft !== saved;
  };

  const isCustomized = (svc) => {
    const saved = dbBenefits?.[svc.id];
    return saved !== undefined && saved !== svc.benefit;
  };

  const flash = (id, text, ok = true) => {
    setMsgs(prev => ({ ...prev, [id]: { text, ok } }));
    setTimeout(() => setMsgs(prev => { const n = { ...prev }; delete n[id]; return n; }), 3500);
  };

  const handleSave = async (svc) => {
    const benefit = effectiveBenefit(svc);
    setSavingId(svc.id);
    try {
      const res = await fetch('/api/service-benefits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: svc.id, benefit }),
      });
      if (!res.ok) throw new Error('Error');
      setDbBenefits(prev => ({ ...prev, [svc.id]: benefit }));
      setDrafts(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
      flash(svc.id, '✓ Guardado');
    } catch { flash(svc.id, 'Error al guardar', false); }
    finally { setSavingId(null); }
  };

  const handleReset = (svc) => {
    setDrafts(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
    setDbBenefits(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
  };

  const filteredServices = SERVICES
    .map(cat => ({
      ...cat,
      items: cat.items.filter(s =>
        !search || s.label.toLowerCase().includes(search.toLowerCase()) ||
        effectiveBenefit(s).toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(cat => cat.items.length > 0);

  const totalCustomized = SERVICES.flatMap(c => c.items).filter(s => isCustomized(s)).length;
  const totalDirty      = Object.keys(drafts).filter(id => {
    const svc = SERVICES.flatMap(c => c.items).find(s => s.id === id);
    return svc && isDirty(svc);
  }).length;

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">✏️ Editor de beneficios</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalCustomized > 0
              ? `${totalCustomized} servicio${totalCustomized > 1 ? 's' : ''} con texto personalizado en DB`
              : 'Todos los textos son los predeterminados'}
            {totalDirty > 0 && ` · ${totalDirty} sin guardar`}
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar servicio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Info */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40 rounded-xl p-4 text-sm text-indigo-700 dark:text-indigo-300">
        <strong>¿Cómo funciona?</strong> Cada servicio tiene un texto predeterminado (en código). Si lo editás y guardás, el texto de la DB tiene prioridad en todos los presupuestos nuevos. El ícono <span className="font-mono bg-indigo-100 dark:bg-indigo-800 px-1 rounded">✦</span> indica que hay un texto personalizado guardado.
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {filteredServices.map(cat => (
          <div key={cat.category} className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => setExpandedCat(expandedCat === cat.category ? null : cat.category)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{cat.category}</span>
                <span className="text-xs text-gray-400">({cat.items.length})</span>
                {cat.items.some(s => isCustomized(s)) && (
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700">
                    ✦ {cat.items.filter(s => isCustomized(s)).length} custom
                  </span>
                )}
                {cat.items.some(s => isDirty(s)) && (
                  <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-700">
                    {cat.items.filter(s => isDirty(s)).length} sin guardar
                  </span>
                )}
              </div>
              <span className="text-gray-400 text-sm">{expandedCat === cat.category ? '▲' : '▼'}</span>
            </button>

            {/* Services */}
            {(expandedCat === cat.category || search) && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {cat.items.map(svc => {
                  const dirty     = isDirty(svc);
                  const custom    = isCustomized(svc);
                  const saving    = savingId === svc.id;
                  const msgEntry  = msgs[svc.id];
                  const current   = effectiveBenefit(svc);

                  return (
                    <div key={svc.id} className="p-5 space-y-3">
                      {/* Service header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">{svc.label}</span>
                            {custom && !dirty && (
                              <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">✦ personalizado</span>
                            )}
                            {dirty && (
                              <span className="text-xs text-orange-500 font-medium">● sin guardar</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{svc.desc}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {custom && (
                            <button
                              onClick={() => handleReset(svc)}
                              className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Volver al texto predeterminado"
                            >
                              Restaurar
                            </button>
                          )}
                          <button
                            onClick={() => handleSave(svc)}
                            disabled={saving || !dirty}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              dirty
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            } disabled:opacity-60`}
                          >
                            {saving ? '⏳' : '💾 Guardar'}
                          </button>
                          {msgEntry && (
                            <span className={`text-xs font-medium ${msgEntry.ok ? 'text-green-500' : 'text-red-400'}`}>
                              {msgEntry.text}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Textarea */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-gray-500 flex items-center gap-1.5">
                          Texto de beneficio
                          {!custom && !dirty && (
                            <span className="text-gray-300 dark:text-gray-600">(predeterminado)</span>
                          )}
                        </label>
                        <textarea
                          value={current}
                          onChange={e => setDrafts(prev => ({ ...prev, [svc.id]: e.target.value }))}
                          rows={2}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 resize-none leading-relaxed placeholder-gray-300"
                          placeholder="Describí qué logra el cliente con este servicio..."
                        />
                        {/* Preview */}
                        {current && (
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 italic border-l-2 border-indigo-200 pl-2 leading-relaxed">
                            {current}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
