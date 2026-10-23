// src/components/leadfinder/LeadFinderForm.jsx
'use client';

import { useState } from 'react';
import { RUBROS, CATEGORIAS_RUBROS, rubroLabel, categoriaLabel } from '@/data/rubros';
import { PROVINCIAS_AR } from '@/data/localidadesAR';
import { parseZona } from '@/lib/leadSearch';

const field = 'px-3 py-2 bg-page border border-fg/10 rounded-lg text-fg text-sm placeholder:text-fg-600 disabled:opacity-60';
const label = 'block text-xs font-medium text-fg-400 mb-2';

// Lista de chips con su input (localidades y términos).
function ChipInput({ items, onChange, placeholder, addLabel, disabled, icon, chipClass }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setText('');
  };
  return (
    <div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map(it => (
            <span key={it} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${chipClass}`}>
              {icon} {it}
              {!disabled && (
                <button type="button" onClick={() => onChange(items.filter(x => x !== it))} className="ml-0.5 hover:text-red-500" aria-label={`Quitar ${it}`}>×</button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" value={text} onChange={e => setText(e.target.value)} disabled={disabled} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className={`flex-1 min-w-0 ${field}`} />
        <button type="button" onClick={add} disabled={disabled || !text.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">
          {addLabel}
        </button>
      </div>
    </div>
  );
}

// Selector provincia → localidad (solo admin): agrega "Localidad, Argentina".
function ProvinciaPicker({ onAdd, disabled }) {
  const [prov, setProv] = useState('');
  const [loc, setLoc] = useState('');
  const localidades = PROVINCIAS_AR.find(p => p.provincia === prov)?.localidades || [];
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <select value={prov} onChange={e => { setProv(e.target.value); setLoc(''); }} disabled={disabled} className={`flex-1 min-w-[140px] ${field}`} aria-label="Provincia">
        <option value="">— Provincia —</option>
        {PROVINCIAS_AR.map(p => <option key={p.provincia} value={p.provincia}>{p.provincia}</option>)}
      </select>
      <select value={loc} onChange={e => setLoc(e.target.value)} disabled={disabled || !prov} className={`flex-1 min-w-[140px] ${field}`} aria-label="Localidad">
        <option value="">— Localidad —</option>
        {localidades.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button type="button" disabled={disabled || !loc} onClick={() => { onAdd(`${loc}, Argentina`); setLoc(''); }}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium">+</button>
    </div>
  );
}

// Cruce con "Rubros buscados": top 10 de rubros con más demanda en Google en la primera
// localidad elegida; un clic los suma/saca de la búsqueda. Gratis (acción rubroDemand).
function DemandSuggest({ zona, tipos, onToggle, onDemand, call, disabled, lang, t }) {
  const [state, setState] = useState({ zona: null, loading: false, top: null, error: null });
  const ciudad = zona ? parseZona(zona).ciudad : '';
  const actual = state.zona === zona;

  const cargar = async () => {
    setState({ zona, loading: true, top: null, error: null });
    try {
      const d = await call('rubroDemand', { localidad: ciudad });
      setState({ zona, loading: false, top: d.top || [], error: null });
      onDemand?.(ciudad, d);
    } catch (e) {
      setState({ zona, loading: false, top: null, error: e.message });
    }
  };

  if (!zona) return <p className="text-xs text-fg-600">{t.demandNeedZona}</p>;

  return (
    <div className="space-y-2">
      <button type="button" onClick={cargar} disabled={disabled || (actual && state.loading)}
        className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-semibold disabled:opacity-50">
        {actual && state.loading ? t.demandLoading : t.demandBtn(ciudad)}
      </button>
      {actual && state.error && <p className="text-xs text-red-500" role="alert">{state.error}</p>}
      {actual && state.top && (state.top.length === 0 ? <p className="text-xs text-fg-500">{t.demandEmpty}</p> : (
        <>
          <p className="text-[11px] text-fg-500">{t.demandHint}</p>
          <div className="flex flex-wrap gap-1.5">
            {state.top.map(r => {
              const on = tipos.includes(r.id);
              return (
                <button key={r.id} type="button" disabled={disabled} onClick={() => onToggle(r.id)} aria-pressed={on}
                  title={t.demandTitle(r)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs disabled:opacity-50
                    ${on ? 'border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-300' : 'border-fg/10 text-fg-300 hover:border-fg/20'}`}>
                  <span>{on ? '✓ ' : '+ '}{rubroLabel(RUBROS.find(x => x.id === r.id), lang) || r.label}</span>
                  <span className="relative w-10 h-1.5 rounded-full bg-fg/10 overflow-hidden">
                    <span className="absolute inset-y-0 left-0 bg-orange-500" style={{ width: `${r.interes}%` }} />
                  </span>
                  <span className="tabular-nums text-fg-500">{r.interes}</span>
                </button>
              );
            })}
          </div>
        </>
      ))}
    </div>
  );
}

// value = { perfil, producto, zonas: string[], terminos: string[], tipos: string[], radioKm, cantidad }
export default function LeadFinderForm({ value, onChange, disabled, lang, variant, balance, t, call, onDemand }) {
  const [showTipos, setShowTipos] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });
  const maxCantidad = balance === null || balance === Infinity ? undefined : Math.max(1, balance);
  const [cantidadTxt, setCantidadTxt] = useState(null); // texto crudo mientras se edita

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>{t.perfilLabel}</span>
        <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t.perfilLabel}>
          {[
            { id: 'dev', label: t.perfilDev, hint: t.perfilDevHint },
            { id: 'empresa', label: t.perfilEmpresa, hint: t.perfilEmpresaHint },
          ].map(opt => (
            <button key={opt.id} type="button" role="radio" aria-checked={value.perfil === opt.id}
              disabled={disabled} onClick={() => set({ perfil: opt.id })}
              className={`text-left px-4 py-3 rounded-xl border transition-colors disabled:opacity-60 ${value.perfil === opt.id
                ? 'bg-indigo-500/10 border-indigo-500/60' : 'bg-page border-fg/10 hover:border-fg/20'}`}>
              <span className="block text-fg text-sm font-semibold">{opt.label}</span>
              <span className="block text-fg-500 text-xs mt-0.5">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {value.perfil === 'empresa' && (
        <div>
          <label className={label} htmlFor="lf-producto">{t.productoLabel} <span className="text-fg-600 font-normal">{t.productoHint}</span></label>
          <input id="lf-producto" type="text" value={value.producto} onChange={e => set({ producto: e.target.value })}
            disabled={disabled} maxLength={60} placeholder={t.productoPlaceholder} className={`w-full ${field}`} />
        </div>
      )}

      <div>
        <span className={label}>{t.zonaLabel} <span className="text-fg-600 font-normal">{t.zonaHint}</span></span>
        <ChipInput items={value.zonas} onChange={zonas => set({ zonas })} placeholder={t.zonaPlaceholder}
          addLabel={t.addBtn} disabled={disabled} icon="📍" chipClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" />
        {variant === 'admin' && (
          <ProvinciaPicker disabled={disabled} onAdd={z => !value.zonas.includes(z) && set({ zonas: [...value.zonas, z] })} />
        )}
      </div>

      <div>
        <span className={label}>{t.terminosLabel} <span className="text-fg-600 font-normal">{t.terminosHint}</span></span>
        <ChipInput items={value.terminos} onChange={terminos => set({ terminos })} placeholder={t.terminosPlaceholder}
          addLabel={t.addBtn} disabled={disabled} icon="🔎" chipClass="bg-blue-500/10 text-blue-600 dark:text-blue-300" />
      </div>

      {call && (
        <DemandSuggest zona={value.zonas[0]} tipos={value.tipos} call={call} onDemand={onDemand} disabled={disabled} lang={lang} t={t}
          onToggle={id => set({ tipos: value.tipos.includes(id) ? value.tipos.filter(x => x !== id) : [...value.tipos, id] })} />
      )}

      <div>
        <button type="button" onClick={() => setShowTipos(v => !v)} aria-expanded={showTipos}
          className="flex items-center gap-2 text-xs font-medium text-fg-400 hover:text-fg">
          <span>{showTipos ? '▾' : '▸'}</span>
          {t.tiposLabel} <span className="text-fg-600 font-normal">{t.tiposHint}</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-fg/5 text-fg-300">{t.tiposToggle(value.tipos.length)}</span>
        </button>
        {showTipos && (
          <div className="mt-3 space-y-3">
            {CATEGORIAS_RUBROS.map(cat => {
              const ids = RUBROS.filter(r => r.cat === cat).map(r => r.id);
              const allOn = ids.every(id => value.tipos.includes(id));
              return (
                <div key={cat}>
                  <button type="button" disabled={disabled}
                    onClick={() => set({ tipos: allOn ? value.tipos.filter(id => !ids.includes(id)) : [...new Set([...value.tipos, ...ids])] })}
                    className="text-[11px] font-semibold uppercase tracking-wide text-fg-500 mb-1.5 hover:text-indigo-500">
                    {categoriaLabel(cat, lang)} <span className="font-normal">({allOn ? t.tiposCatNone : t.tiposCatAll})</span>
                  </button>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {RUBROS.filter(r => r.cat === cat).map(r => {
                      const checked = value.tipos.includes(r.id);
                      return (
                        <label key={r.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none
                          ${checked ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-fg/10 text-fg-400 hover:border-fg/20'}
                          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input type="checkbox" checked={checked} disabled={disabled} className="accent-indigo-600 w-3 h-3"
                            onChange={e => set({ tipos: e.target.checked ? [...value.tipos, r.id] : value.tipos.filter(id => id !== r.id) })} />
                          {rubroLabel(r, lang)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={label} htmlFor="lf-radio">{t.radioLabel}</label>
          <input id="lf-radio" type="number" min={1} max={50} value={value.radioKm} disabled={disabled}
            onChange={e => set({ radioKm: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)) })} className={`w-28 ${field}`} />
        </div>
        <div>
          <label className={label} htmlFor="lf-cantidad">{t.cantidadLabel} <span className="text-fg-600 font-normal">{t.cantidadHint}</span></label>
          <input id="lf-cantidad" type="number" min={1} max={maxCantidad} value={cantidadTxt ?? value.cantidad} disabled={disabled}
            onChange={e => {
              setCantidadTxt(e.target.value);
              const v = parseInt(e.target.value, 10);
              if (Number.isInteger(v) && v >= 1) set({ cantidad: maxCantidad ? Math.min(v, maxCantidad) : v });
            }}
            onBlur={() => setCantidadTxt(null)}
            className={`w-28 ${field}`} />
        </div>
        <span className="pb-2 text-xs text-fg-500">
          {balance === null ? '' : balance === Infinity ? t.balanceUnlimited : balance <= 0 ? t.balanceZero : t.balanceAvailable(balance)}
        </span>
      </div>
    </div>
  );
}
