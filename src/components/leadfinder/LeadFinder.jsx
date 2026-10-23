// src/components/leadfinder/LeadFinder.jsx
// Buscador único de Lead Finder: lo usan /lead-finder-pro/buscar (variant="cliente") y la pestaña
// Lead Finder del admin (variant="admin"). Ver docs/superpowers/specs/2026-10-12-lead-finder-unificado-design.md
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebaseservice';
import { useAuthUser } from '@/hooks/useAuthUser';
import { lfpT } from '@/data/i18n/leadFinderPro';
import { RUBROS, rubroLabel } from '@/data/rubros';
import { parseZona, productosPatch } from '@/lib/leadSearch';
import { oportunidad } from '@/lib/rubroDemand';
import { useLeadSearch } from './useLeadSearch';
import LeadFinderForm from './LeadFinderForm';
import LeadResultsTable, { exportLeadsCSV } from './LeadResultsTable';
import LeadSearchHistory from './LeadSearchHistory';
import MailBatchPanel from '@/components/leadfinderpro/MailBatchPanel';
import { AdminFilters, AdminLog, PublishReport, applyAdminFilters, EMPTY_FILTERS } from './admin/LeadFinderAdminExtras';
import InstagramProspects from './admin/InstagramProspects';

const FORM_CLIENTE = { perfil: 'dev', producto: '', zonas: [], terminos: [], tipos: [], radioKm: 10, cantidad: 10 };
const FORM_ADMIN = { ...FORM_CLIENTE, zonas: ['Neuquén, Argentina'], cantidad: 20 };
const ADMIN_FORM_KEY = 'admin_lf_form_v2';

// Mismo cálculo que el gate del server, solo para mostrar el saldo (nunca decide el cobro).
function computeBalance(e) {
  if (!e) return 0;
  if (e.unlimited === true && e.status === 'active') return Infinity;
  if (e.billingType === 'subscription' && e.status === 'active' && e.planCredits > 0) {
    const used = e.usagePeriod === new Date().toISOString().slice(0, 7) ? (e.usageCount || 0) : 0;
    return Math.max(0, e.planCredits - used);
  }
  return e.credits || 0;
}

function loadAdminForm() {
  try {
    const s = localStorage.getItem(ADMIN_FORM_KEY);
    if (s) return { ...FORM_ADMIN, ...JSON.parse(s) };
  } catch { /* sin storage */ }
  return FORM_ADMIN;
}

// Demanda del rubro de un lead: { [ciudad]: respuesta de rubroDemand }. Los rubros de Maps se
// buscan por id (la etiqueta cambia con el idioma); los términos libres, por el texto.
function demandaDe(lead, demanda, labelToId) {
  if (lead.demanda) return lead.demanda; // ya guardada en el historial
  const d = demanda[lead.ciudad];
  if (!d) return null;
  const id = labelToId[lead.tipo];
  return (id ? d.porRubro?.[id] : d.porTermino?.[lead.tipo]) || null;
}

// Prefill desde "Rubros buscados" (?zona=…&rubro=… o sessionStorage en el admin).
const PREFILL_KEY = 'lf_prefill';
function readPrefill() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('zona') || q.get('rubro')) return { zona: q.get('zona'), rubro: q.get('rubro') };
    const s = sessionStorage.getItem(PREFILL_KEY);
    if (s) { sessionStorage.removeItem(PREFILL_KEY); return JSON.parse(s); }
  } catch { /* sin storage */ }
  return null;
}
function applyPrefill(form, p) {
  if (!p) return form;
  return {
    ...form,
    zonas: p.zona ? [p.zona] : form.zonas,
    tipos: p.rubro && RUBROS.some(r => r.id === p.rubro) ? [p.rubro] : form.tipos,
    terminos: p.rubro ? [] : form.terminos,
  };
}

function labelToIdFor(ids, lang) {
  return Object.fromEntries(tipoParams(ids, lang).map(p => [p.label, p.id]));
}

function tipoParams(ids, lang) {
  return ids.map(id => {
    const r = RUBROS.find(x => x.id === id);
    return { id, label: rubroLabel(r, lang) || id, ...(r?.query ? { query: r.query } : {}) };
  });
}

export default function LeadFinder({ variant = 'cliente', lang = 'es', forceDark = false }) {
  const t = lfpT(lang).panel;
  const isAdmin = variant === 'admin';
  const { user, getIdToken, login } = useAuthUser();

  const [form, setForm] = useState(isAdmin ? FORM_ADMIN : FORM_CLIENTE);
  const [showForm, setShowForm] = useState(true);
  const [balance, setBalance] = useState(null); // null = sin cargar, Infinity = ilimitado
  const [history, setHistory] = useState([]);
  const [loadingSavedId, setLoadingSavedId] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchKey, setSearchKey] = useState(0); // cambia con cada búsqueda/historial abierto: reinicia el informe

  const [demanda, setDemanda] = useState({}); // ciudad → { porRubro, porTermino, top }
  const [porOportunidad, setPorOportunidad] = useState(true);
  const addDemanda = useCallback((ciudad, d) => setDemanda(m => ({ ...m, [ciudad]: d })), []);

  useEffect(() => {
    const prefill = readPrefill();
    if (isAdmin) setForm(applyPrefill(loadAdminForm(), prefill));
    else if (prefill) setForm(f => applyPrefill(f, prefill));
  }, [isAdmin]);

  const call = useCallback(async (action, params = {}) => {
    const idToken = await getIdToken();
    const resp = await fetch('/api/lead-finder-pro/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ action, ...params }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
      const code = resp.status === 401 ? 'NO_AUTH' : resp.status === 402 ? 'NO_PLAN' : (data.code || null);
      throw Object.assign(new Error(data.error || `Error ${resp.status}`), { code });
    }
    return data;
  }, [getIdToken]);

  const search = useLeadSearch(call);
  const isRunning = search.phase === 'searching';

  const refreshBalance = useCallback(() => {
    if (!user) { setBalance(null); return; }
    getDoc(doc(db, 'leadfinder_entitlements', user.uid))
      .then(snap => setBalance(computeBalance(snap.data())))
      .catch(() => setBalance(0));
  }, [user]);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);
  // Si el saldo es menor a la cantidad elegida, se baja la cantidad al saldo.
  useEffect(() => {
    if (!isAdmin && balance !== null && balance !== Infinity && balance > 0 && form.cantidad > balance) setForm(f => ({ ...f, cantidad: balance }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  const authHeaders = useCallback(async () => {
    const idToken = await getIdToken();
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  }, [getIdToken]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const resp = await fetch('/api/lead-finder-pro/searches', { headers: await authHeaders() });
      const data = await resp.json().catch(() => ({}));
      setHistory(data.items || []);
    } catch { /* noop */ }
  }, [user, authHeaders]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const start = async () => {
    if (isAdmin) { try { localStorage.setItem(ADMIN_FORM_KEY, JSON.stringify(form)); } catch { /* sin storage */ } }
    setShowForm(false);
    setFilters(EMPTY_FILTERS);
    setSearchKey(k => k + 1);
    const zonas = form.zonas.map(parseZona);
    // Demanda por zona en paralelo a la búsqueda (gratis; si falla, los leads salen sin ella).
    const demandaPromise = Promise.all(zonas.map(z =>
      call('rubroDemand', { localidad: z.ciudad, terminos: form.terminos })
        .then(d => { addDemanda(z.ciudad, d); return [z.ciudad, d]; })
        .catch(() => null)));
    const { leads, totals } = await search.run({
      zonas,
      terminos: form.terminos,
      tipos: tipoParams(form.tipos, lang),
      radioKm: form.radioKm,
      cantidad: form.cantidad,
      perfil: form.perfil,
      producto: form.producto,
    });
    refreshBalance();
    if (leads.length) {
      const dmap = Object.fromEntries((await demandaPromise).filter(Boolean));
      const l2id = labelToIdFor(form.tipos, lang);
      const conDemanda = leads.map(l => ({ ...l, demanda: demandaDe(l, dmap, l2id) }));
      try {
        await fetch('/api/lead-finder-pro/searches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({
            ciudades: form.zonas, terminos: form.terminos, tipos: form.tipos, radioKm: form.radioKm,
            perfil: form.perfil, producto: form.producto, stats: totals, origen: isAdmin ? 'admin' : 'cliente', results: conDemanda,
          }),
        });
        loadHistory();
      } catch { /* el historial no bloquea la búsqueda */ }
    }
  };

  const openSaved = async (id) => {
    setLoadingSavedId(id);
    try {
      const resp = await fetch(`/api/lead-finder-pro/searches?id=${id}`, { headers: await authHeaders() });
      const data = await resp.json().catch(() => ({}));
      if (data.results) {
        search.load(data.results, data.stats || null);
        setSearchKey(k => k + 1);
        setForm(f => ({
          ...f, zonas: data.ciudades || [], terminos: data.terminos || [], tipos: data.tipos || [],
          radioKm: data.radioKm || 10, producto: data.producto || '',
          perfil: data.perfil || (data.results.some(r => r.prodState) ? 'empresa' : 'dev'),
        }));
        setShowForm(false);
      }
    } catch { /* no se pudo abrir: queda el historial como estaba */ } finally {
      setLoadingSavedId(null);
    }
  };

  const retryProducts = async (lead) => {
    search.patchLead(lead.id, { prodState: 'loading' });
    try {
      const d = await call('countProducts', { placeId: lead.id, keyword: form.producto.trim() });
      search.patchLead(lead.id, productosPatch(d));
    } catch {
      search.patchLead(lead.id, { prodState: 'error' });
    }
  };

  const deleteSaved = async (id) => {
    try {
      const resp = await fetch(`/api/lead-finder-pro/searches?id=${id}`, { method: 'DELETE', headers: await authHeaders() });
      if (resp.ok) setHistory(prev => prev.filter(h => h.id !== id));
    } catch { /* se queda en la lista */ }
  };

  const labelToId = useMemo(() => labelToIdFor(form.tipos, lang), [form.tipos, lang]);
  const leadsConDemanda = useMemo(
    () => search.leads.map(l => { const d = demandaDe(l, demanda, labelToId); return d ? { ...l, demanda: d } : l; }),
    [search.leads, demanda, labelToId]);
  const hayDemanda = leadsConDemanda.some(l => l.demanda);
  const rows = useMemo(() => {
    const base = isAdmin ? applyAdminFilters(leadsConDemanda, filters) : leadsConDemanda;
    return porOportunidad && hayDemanda ? [...base].sort((a, b) => oportunidad(b) - oportunidad(a)) : base;
  }, [isAdmin, leadsConDemanda, filters, porOportunidad, hayDemanda]);
  const emails = useMemo(() => search.leads.map(r => r.email).filter(Boolean), [search.leads]);
  const tipoLabels = form.tipos.map(id => rubroLabel(RUBROS.find(r => r.id === id), lang) || id);
  const hasCriteria = form.terminos.length > 0 || form.tipos.length > 0;
  const canStart = form.zonas.length > 0 && hasCriteria && form.cantidad > 0 && (form.perfil !== 'empresa' || form.producto.trim().length >= 2);
  const noCredits = !isAdmin && balance !== null && balance !== Infinity && balance <= 0;
  const stopCode = search.stop?.code;

  let content;
  if (isAdmin && !user) {
    content = (
      <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-700 dark:text-amber-400">Iniciá sesión con la cuenta admin para buscar: esta herramienta gasta cuota de Google.</p>
        <button onClick={login} className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg">Iniciar sesión</button>
      </div>
    );
  } else if (!isAdmin && (noCredits || stopCode === 'NO_PLAN') && !search.leads.length) {
    content = (
      <div className="bg-card border border-amber-500/30 rounded-2xl p-8 text-center">
        <p className="text-3xl mb-3">🔒</p>
        <h3 className="text-fg font-bold text-lg mb-2">{t.blockedTitle}</h3>
        <p className="text-fg-400 text-sm mb-5">{t.blockedDesc}</p>
        <a href={lang === 'en' ? '/en/lead-finder-pro#planes' : '/lead-finder-pro#planes'} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl text-sm">{t.blockedCta}</a>
      </div>
    );
  } else {
    content = (
      <div className="space-y-5">
        {stopCode === 'QUOTA_EXCEEDED' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4" role="alert">
            <p className="text-amber-700 dark:text-amber-300 font-semibold text-sm">⏳ {t.quotaTitle}</p>
            <p className="text-fg-400 text-xs mt-0.5">{t.quotaDesc}</p>
          </div>
        )}
        {stopCode === 'DISCARD_LIMIT' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4" role="alert">
            <p className="text-amber-700 dark:text-amber-300 font-semibold text-sm">⏳ {t.discardTitle}</p>
            <p className="text-fg-400 text-xs mt-0.5">{t.discardDesc}</p>
          </div>
        )}
        {stopCode === 'NO_PLAN' && search.leads.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 text-sm text-amber-700 dark:text-amber-300" role="alert">{t.blockedTitle}</div>
        )}

        <LeadSearchHistory items={history} onOpen={openSaved} onDelete={deleteSaved} loadingId={loadingSavedId} disabled={isRunning} t={t} />

        <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
          <button onClick={() => setShowForm(v => !v)} aria-expanded={showForm} className="w-full flex items-center justify-between px-5 py-4 hover:bg-fg/5">
            <span className="text-fg font-semibold text-sm">{t.sectionHeader}</span>
            <span className="text-fg-500 text-xs">{showForm ? '▲' : '▼'}</span>
          </button>
          {showForm && (
            <div className="p-5 border-t border-fg/10">
              <LeadFinderForm value={form} onChange={setForm} disabled={isRunning} lang={lang} variant={variant} balance={balance} t={t}
                call={user ? call : null} onDemand={addDemanda} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-fg/5 border-t border-fg/10">
            {!isRunning ? (
              <button onClick={start} disabled={!canStart}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm">{t.searchBtn}</button>
            ) : (
              <button onClick={search.cancel} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-sm">{t.stopBtn}</button>
            )}
            {search.leads.length > 0 && (
              <button onClick={() => exportLeadsCSV(leadsConDemanda, t)} className="px-4 py-2.5 bg-fg/5 hover:bg-fg/10 text-fg rounded-xl text-sm font-medium">{t.csvBtn}</button>
            )}
            {isAdmin && search.leads.length > 0 && (
              <PublishReport key={searchKey} leads={search.leads} form={form} tipoLabels={tipoLabels} disabled={isRunning} />
            )}
            {!canStart && !isRunning && form.zonas.length > 0 && !hasCriteria && <span className="text-xs text-fg-500">{t.needCriteria}</span>}
            {search.stop && !isRunning && !('QUOTA_EXCEEDED DISCARD_LIMIT NO_PLAN'.split(' ').includes(stopCode)) && <span className="text-xs text-red-500 ml-auto" role="alert">{search.stop.message}</span>}
          </div>
        </div>

        {isRunning && (
          <div className="bg-card border border-fg/10 rounded-2xl p-4 text-xs text-fg-400 space-y-1" aria-live="polite">
            <p>{t.progress({ ciudad: search.progress.ciudad, etiqueta: search.progress.etiqueta, leads: search.totals.leads, cantidad: form.cantidad, examinados: search.totals.examinados })}</p>
            {search.pendiente && <p className="text-fg-500">{t.checking(search.pendiente.nombre)}</p>}
          </div>
        )}

        {(search.leads.length > 0 || search.phase === 'done') && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-sm text-fg-300" aria-live="polite">{t.summary(search.totals)}</p>
            {hayDemanda && (
              <label className="flex items-center gap-2 text-xs text-fg-400 cursor-pointer">
                <input type="checkbox" checked={porOportunidad} onChange={e => setPorOportunidad(e.target.checked)} className="accent-orange-500" />
                🔥 {t.sortOpportunity}
              </label>
            )}
          </div>
        )}

        {search.avisos.length > 0 && !isRunning && (
          <details className="bg-card border border-fg/10 rounded-2xl px-5 py-3 text-xs text-fg-400">
            <summary className="cursor-pointer">{t.warningsTitle(search.avisos.length)}</summary>
            <ul className="mt-2 space-y-1 list-disc pl-5">{search.avisos.map((a, i) => <li key={i}>{a.mensaje}</li>)}</ul>
          </details>
        )}

        {emails.length > 0 && !isRunning && <MailBatchPanel emails={emails} userEmail={user?.email} t={t.mail} />}

        {isAdmin && search.leads.length > 0 && (
          <AdminFilters rows={search.leads} filters={filters} setFilters={setFilters} shown={rows.length} />
        )}

        {rows.length > 0 && <LeadResultsTable rows={rows} perfil={form.perfil} t={t} onRetryProducts={retryProducts} retryDisabled={isRunning} />}

        {isAdmin && !isRunning && search.leads.length > 0 && <InstagramProspects leads={rows} />}

        {isAdmin && <AdminLog log={search.log} />}
      </div>
    );
  }

  return forceDark ? <div className="dark text-fg">{content}</div> : content;
}
