'use client';

import { useState, useEffect } from 'react';
import { ADMIN_NAV_DEFAULT } from '@/data/adminNav';
import { CLIENT_NAV_DEFAULT } from '@/data/clientNav';

const DEFAULTS = { admin: ADMIN_NAV_DEFAULT, client: CLIENT_NAV_DEFAULT };

function getAdminPassword() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '';
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `sec-${Date.now()}`;
}

// Mueve un elemento dentro de un array (reordenar arriba/abajo)
function move(arr, index, dir) {
  const next = [...arr];
  const j = index + dir;
  if (j < 0 || j >= next.length) return arr;
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export default function NavConfigEditor() {
  const [tree, setTree] = useState('admin');
  const [sections, setSections] = useState(DEFAULTS.admin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [newSectionLabel, setNewSectionLabel] = useState('');

  const load = (t) => {
    setLoading(true);
    fetch(`/api/nav-config?tree=${t}`)
      .then(r => r.json())
      .then(data => setSections(data.sections?.length ? data.sections : DEFAULTS[t]))
      .catch(() => setSections(DEFAULTS[t]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tree); }, [tree]);

  const isClient = tree === 'client';

  const updateSection = (sIdx, patch) =>
    setSections(prev => prev.map((s, i) => i === sIdx ? { ...s, ...patch } : s));

  const updateItem = (sIdx, iIdx, patch) =>
    setSections(prev => prev.map((s, i) => i !== sIdx ? s : {
      ...s, items: s.items.map((it, j) => j === iIdx ? { ...it, ...patch } : it),
    }));

  const updateChild = (sIdx, iIdx, cIdx, patch) =>
    setSections(prev => prev.map((s, i) => i !== sIdx ? s : {
      ...s, items: s.items.map((it, j) => j !== iIdx ? it : {
        ...it, children: it.children.map((c, k) => k === cIdx ? { ...c, ...patch } : c),
      }),
    }));

  const moveSection = (sIdx, dir) => setSections(prev => move(prev, sIdx, dir));
  const moveItem = (sIdx, iIdx, dir) =>
    setSections(prev => prev.map((s, i) => i !== sIdx ? s : { ...s, items: move(s.items, iIdx, dir) }));

  const moveItemToSection = (sIdx, iIdx, targetSIdx) => {
    if (sIdx === targetSIdx) return;
    setSections(prev => {
      const next = prev.map(s => ({ ...s, items: [...s.items] }));
      const [item] = next[sIdx].items.splice(iIdx, 1);
      next[targetSIdx].items.push(item);
      return next;
    });
  };

  const addSection = () => {
    if (!newSectionLabel.trim()) return;
    setSections(prev => [...prev, { id: slugify(newSectionLabel), label: newSectionLabel.trim(), icon: '📁', items: [] }]);
    setNewSectionLabel('');
  };

  const deleteSection = (sIdx) => {
    if (sections[sIdx].items.length > 0) {
      alert('Esta sección tiene items adentro — move´los a otra sección antes de borrarla.');
      return;
    }
    if (!confirm(`¿Eliminar la sección "${sections[sIdx].label}"?`)) return;
    setSections(prev => prev.filter((_, i) => i !== sIdx));
  };

  const restoreDefault = () => {
    if (!confirm('¿Restaurar la estructura por defecto? Se pierden los cambios sin guardar.')) return;
    setSections(DEFAULTS[tree]);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const adminPassword = getAdminPassword();
      const res = await fetch('/api/nav-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, tree, sections }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setMsg({ type: 'ok', text: 'Guardado. El menú se actualiza en la próxima carga de página.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Configurar interfaz</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Renombrá secciones/items, reordená, y movéalos de sección. Cambia el menú de {isClient ? 'los clientes logueados' : 'este panel admin'}.
          </p>
        </div>
        <div className="flex items-center bg-gray-50 dark:bg-gray-800/40 rounded-xl p-1">
          {[['admin', 'Admin'], ['client', 'Cliente']].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTree(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tree === t ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${msg.type === 'ok' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
          {msg.text}
        </div>
      )}

      <div className="space-y-3">
        {sections.map((section, sIdx) => (
          <div key={section.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <input value={section.icon} onChange={e => updateSection(sIdx, { icon: e.target.value })}
                className="w-12 text-center rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm" />
              <input value={section.label} onChange={e => updateSection(sIdx, { label: e.target.value })}
                className="flex-1 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm font-semibold" />
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1">Nivel 1</span>
              <button onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0} className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-neutral-800">↑</button>
              <button onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1} className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-neutral-800">↓</button>
              <button onClick={() => deleteSection(sIdx)} className="px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-medium">Eliminar</button>
            </div>

            <div className="space-y-2 pl-4 border-l-2 border-gray-100 dark:border-neutral-800">
              {section.items.map((item, iIdx) => (
                <div key={item.id}>
                  <div className="flex items-center gap-2">
                    <input value={item.icon || ''} onChange={e => updateItem(sIdx, iIdx, { icon: e.target.value })}
                      className="w-10 text-center rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs" />
                    <input value={item.label} onChange={e => updateItem(sIdx, iIdx, { label: e.target.value })}
                      className="flex-1 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-2.5 py-1 text-sm" />
                    {isClient && (
                      <input value={item.path || ''} onChange={e => updateItem(sIdx, iIdx, { path: e.target.value })}
                        placeholder="/ruta"
                        className="w-40 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 px-2.5 py-1 text-xs font-mono" />
                    )}
                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1 shrink-0">Nivel 2</span>
                    <select
                      value={sIdx}
                      onChange={e => moveItemToSection(sIdx, iIdx, Number(e.target.value))}
                      className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 px-2 py-1 text-xs"
                      title="Mover a otra sección"
                    >
                      {sections.map((s, i) => <option key={s.id} value={i}>{s.icon} {s.label}</option>)}
                    </select>
                    <button onClick={() => moveItem(sIdx, iIdx, -1)} disabled={iIdx === 0} className="px-1.5 py-1 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 disabled:opacity-30 text-xs">↑</button>
                    <button onClick={() => moveItem(sIdx, iIdx, 1)} disabled={iIdx === section.items.length - 1} className="px-1.5 py-1 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 disabled:opacity-30 text-xs">↓</button>
                  </div>

                  {item.children?.length > 0 && (
                    <div className="mt-1.5 mb-1 pl-8 space-y-1.5">
                      {item.children.map((child, cIdx) => (
                        <div key={child.id} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest w-14 shrink-0">Nivel 3</span>
                          <input value={child.label} onChange={e => updateChild(sIdx, iIdx, cIdx, { label: e.target.value })}
                            className="flex-1 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/60 dark:bg-neutral-800/60 text-gray-700 dark:text-gray-300 px-2.5 py-1 text-xs" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {section.items.length === 0 && (
                <p className="text-xs text-gray-400 italic py-1">Sin items — arrastrá uno acá cambiando su sección arriba.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newSectionLabel}
          onChange={e => setNewSectionLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addSection(); }}
          placeholder="Nombre de la nueva sección..."
          className="flex-1 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
        />
        <button onClick={addSection} className="px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800">
          + Sección
        </button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={restoreDefault} className="text-xs text-gray-500 hover:text-red-500 transition-colors">
          Restaurar estructura por defecto
        </button>
        <button onClick={save} disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
