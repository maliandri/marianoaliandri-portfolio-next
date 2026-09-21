'use client';

import { useState, useEffect } from 'react';
import { SERVICES } from '../../data/serviceCatalog';

export default function BenefitsEditor() {
  const [dbBenefits, setDbBenefits]   = useState(null);
  const [drafts,     setDrafts]       = useState({});
  const [savingId,   setSavingId]     = useState(null);
  const [msgs,       setMsgs]         = useState({});
  const [search,     setSearch]       = useState('');
  const [expandedCats, setExpandedCats] = useState(new Set([SERVICES[0]?.category]));
  const [loading,    setLoading]      = useState(true);

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
    return draft !== (dbBenefits?.[svc.id] ?? svc.benefit);
  };

  const isCustomized = (svc) => {
    const saved = dbBenefits?.[svc.id];
    return saved !== undefined && saved !== svc.benefit;
  };

  const flash = (id, text, ok = true) => {
    setMsgs(prev => ({ ...prev, [id]: { text, ok } }));
    setTimeout(() => setMsgs(prev => { const n = { ...prev }; delete n[id]; return n; }), 3000);
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
      flash(svc.id, 'Guardado');
    } catch { flash(svc.id, 'Error', false); }
    finally { setSavingId(null); }
  };

  const handleReset = (svc) => {
    setDrafts(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
    setDbBenefits(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
  };

  const toggleCat = (cat) => setExpandedCats(prev => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  const expandAll  = () => setExpandedCats(new Set(SERVICES.map(c => c.category)));
  const collapseAll = () => setExpandedCats(new Set());

  const filteredServices = SERVICES
    .map(cat => ({
      ...cat,
      items: cat.items.filter(s =>
        !search ||
        s.label.toLowerCase().includes(search.toLowerCase()) ||
        s.desc.toLowerCase().includes(search.toLowerCase()) ||
        effectiveBenefit(s).toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(cat => cat.items.length > 0);

  const allSvcs         = SERVICES.flatMap(c => c.items);
  const totalServices   = allSvcs.length;
  const totalCustomized = allSvcs.filter(s => isCustomized(s)).length;
  const totalDirty      = allSvcs.filter(s => isDirty(s)).length;
  const totalValue      = allSvcs.reduce((sum, s) => sum + (s.price || 0), 0);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Catálogo de servicios</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalServices} servicios · valor total catálogo{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              USD {totalValue.toLocaleString()}
            </span>
            {totalCustomized > 0 && ` · ${totalCustomized} con texto custom`}
            {totalDirty > 0 && <span className="text-orange-500"> · {totalDirty} sin guardar</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll}   className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-white/5 transition-colors">Expandir todo</button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-white/5 transition-colors">Colapsar todo</button>
          <input
            type="text"
            placeholder="Buscar servicio..."
            value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value) expandAll(); }}
            className="w-48 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="space-y-2">
        {filteredServices.map(cat => {
          const expanded     = expandedCats.has(cat.category) || !!search;
          const catCustom    = cat.items.filter(s => isCustomized(s)).length;
          const catDirty     = cat.items.filter(s => isDirty(s)).length;
          const catValue     = cat.items.reduce((sum, s) => sum + (s.price || 0), 0);

          return (
            <div key={cat.category} className="border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">

              {/* Category header */}
              <button
                onClick={() => toggleCat(cat.category)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{cat.category}</span>
                  <span className="text-xs text-gray-400 shrink-0">{cat.items.length} servicios</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                    USD {catValue.toLocaleString()}
                  </span>
                  {catCustom > 0 && (
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full shrink-0">
                      ✦ {catCustom} custom
                    </span>
                  )}
                  {catDirty > 0 && (
                    <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-500 px-1.5 py-0.5 rounded-full shrink-0">
                      ● {catDirty} sin guardar
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-xs shrink-0 ml-2">{expanded ? '▲' : '▼'}</span>
              </button>

              {/* Table inside category */}
              {expanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-900/30">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-[180px]">Servicio</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-[200px]">Stack técnico</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-[90px]">Precio USD</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Texto beneficio (presupuesto)</th>
                        <th className="px-3 py-2 w-[110px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                      {cat.items.map(svc => {
                        const dirty   = isDirty(svc);
                        const custom  = isCustomized(svc);
                        const saving  = savingId === svc.id;
                        const msgEntry = msgs[svc.id];

                        return (
                          <tr
                            key={svc.id}
                            className={`group transition-colors ${
                              dirty   ? 'bg-orange-50/40 dark:bg-orange-900/10' :
                              custom  ? 'bg-indigo-50/30 dark:bg-indigo-900/10' :
                                        'bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/30'
                            }`}
                          >
                            {/* Nombre */}
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-start gap-1.5">
                                <span className={`font-medium text-sm leading-snug ${
                                  custom ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'
                                }`}>
                                  {svc.label}
                                </span>
                                {custom && !dirty && <span className="text-indigo-400 text-xs mt-0.5 shrink-0">✦</span>}
                                {dirty && <span className="text-orange-400 text-xs mt-0.5 shrink-0">●</span>}
                              </div>
                            </td>

                            {/* Stack */}
                            <td className="px-3 py-3 align-top">
                              <span className="text-xs text-gray-500 leading-snug">{svc.desc}</span>
                            </td>

                            {/* Precio */}
                            <td className="px-3 py-3 align-top text-right">
                              <span className={`text-sm font-semibold tabular-nums ${
                                svc.price >= 1000 ? 'text-indigo-600 dark:text-indigo-400' :
                                svc.price >= 300  ? 'text-emerald-600 dark:text-emerald-400' :
                                                    'text-teal-500 dark:text-teal-400'
                              }`}>
                                ${svc.price?.toLocaleString()}
                              </span>
                            </td>

                            {/* Beneficio editable */}
                            <td className="px-3 py-2 align-top">
                              <textarea
                                value={effectiveBenefit(svc)}
                                onChange={e => setDrafts(prev => ({ ...prev, [svc.id]: e.target.value }))}
                                rows={2}
                                className="w-full bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-indigo-400 dark:focus:border-indigo-500 rounded-lg px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-400/30 resize-none leading-relaxed transition-colors placeholder-gray-300"
                                placeholder="Texto para el presupuesto..."
                              />
                            </td>

                            {/* Acciones */}
                            <td className="px-3 py-3 align-top">
                              <div className="flex flex-col items-end gap-1.5">
                                {msgEntry ? (
                                  <span className={`text-[10px] font-medium ${msgEntry.ok ? 'text-green-500' : 'text-red-400'}`}>
                                    {msgEntry.text}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleSave(svc)}
                                      disabled={saving || !dirty}
                                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                                        dirty
                                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                          : 'text-gray-300 dark:text-gray-600 cursor-default'
                                      } disabled:opacity-50`}
                                    >
                                      {saving ? '...' : dirty ? 'Guardar' : 'Guardado'}
                                    </button>
                                    {custom && (
                                      <button
                                        onClick={() => handleReset(svc)}
                                        className="text-[10px] text-gray-400 hover:text-red-400 transition-colors"
                                      >
                                        Restaurar
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 rounded-xl text-sm">
        <span className="text-gray-500">{totalServices} servicios en catálogo</span>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">Valor total del catálogo</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base tabular-nums">
            USD {totalValue.toLocaleString()}
          </span>
        </div>
      </div>

    </div>
  );
}
