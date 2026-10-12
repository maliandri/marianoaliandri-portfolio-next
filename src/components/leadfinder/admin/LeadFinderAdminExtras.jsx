// src/components/leadfinder/admin/LeadFinderAdminExtras.jsx
// Lo que solo ve el admin en el buscador: filtros, log en vivo y publicar informe + redes.
'use client';

import { useState, useEffect, useRef } from 'react';
import { filasParaInforme, parseZona } from '@/lib/leadSearch';
import { buildAuditPublishPayload } from '@/lib/socialAuditPost';

export const EMPTY_FILTERS = { tipo: '', email: false, seoBajo: false, texto: '' };
export const MIN_SITIOS_INFORME = 3; // misma regla que la auditoría automática

export function applyAdminFilters(rows, f) {
  return rows.filter(r => {
    if (f.tipo && r.tipo !== f.tipo) return false;
    if (f.email && !r.email) return false;
    if (f.seoBajo && (typeof r.seoScore !== 'number' || r.seoScore >= 50)) return false;
    if (f.texto && !r.nombre.toLowerCase().includes(f.texto.toLowerCase())) return false;
    return true;
  });
}

const ctl = 'px-2.5 py-1.5 border border-fg/10 rounded-lg bg-page text-fg text-sm';

export function AdminFilters({ rows, filters, setFilters, shown }) {
  const tipos = [...new Set(rows.map(r => r.tipo))];
  return (
    <div className="flex flex-wrap items-center gap-3 bg-card border border-fg/10 rounded-2xl p-4">
      <span className="text-sm font-semibold text-fg">{shown}/{rows.length} resultados</span>
      <select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })} className={ctl} aria-label="Filtrar por rubro">
        <option value="">Todos los rubros</option>
        {tipos.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-fg-400">
        <input type="checkbox" checked={filters.email} onChange={e => setFilters({ ...filters, email: e.target.checked })} className="accent-indigo-600" /> Con email
      </label>
      <label className="flex items-center gap-1.5 text-sm text-fg-400">
        <input type="checkbox" checked={filters.seoBajo} onChange={e => setFilters({ ...filters, seoBajo: e.target.checked })} className="accent-red-500" /> SEO bajo (&lt; 50)
      </label>
      <input type="text" value={filters.texto} onChange={e => setFilters({ ...filters, texto: e.target.value })} placeholder="Buscar nombre…" aria-label="Buscar nombre" className={`${ctl} w-40`} />
    </div>
  );
}

export function AdminLog({ log }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log, open]);
  if (!log.length) return null;
  return (
    <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-fg-500 uppercase tracking-wide hover:bg-fg/5">
        Log ({log.length}) <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div ref={ref} className="h-44 overflow-y-auto px-4 py-2 space-y-0.5 font-mono text-xs border-t border-fg/10">
          {log.map((l, i) => (
            <div key={i} className={l.level === 'error' ? 'text-red-500' : l.level === 'success' ? 'text-green-600 dark:text-green-400' : l.level === 'warn' ? 'text-yellow-600 dark:text-yellow-400' : 'text-fg-500'}>
              <span className="text-fg-600 mr-2 select-none">{l.time}</span>{l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function rubrosTexto(labels) {
  if (!labels.length) return 'negocios locales';
  if (labels.length === 1) return labels[0];
  if (labels.length <= 3) return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`;
  return `${labels.slice(0, 3).join(', ')} y ${labels.length - 3} más`;
}

// form = valor del formulario; tipoLabels = etiquetas de los tipos elegidos.
export function PublishReport({ leads, form, tipoLabels, disabled }) {
  const filas = filasParaInforme(leads);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [toSocial, setToSocial] = useState(true);
  const [nets, setNets] = useState({ linkedin: true, instagram: true, facebook: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState(null);
  const [savedUrl, setSavedUrl] = useState(null); // informe ya guardado cuando falla la parte de redes
  const [savedId, setSavedId] = useState(null);

  const ciudades = form.zonas.map(z => parseZona(z).ciudad);
  const rubros = [...tipoLabels, ...form.terminos];
  const total = filas.length;
  const low = filas.filter(f => f.seoScore < 50).length;
  const withEmail = filas.filter(f => f.email).length;
  const avg = total ? Math.round(filas.reduce((s, f) => s + f.seoScore, 0) / total) : null;

  const abrir = () => {
    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    const r = rubrosTexto(rubros);
    const pct = total ? Math.round((low / total) * 100) : 0;
    setTitle(`Auditoría SEO de páginas web de ${r} (${fecha})`);
    setDesc(
      `Auditoría SEO de ${total} sitios web de ${r} en ${ciudades.join(', ') || 'varias ciudades'}. ` +
      `El ${pct}% (${low}) tiene un posicionamiento web débil y el promedio general es ${avg ?? '—'}/100. ` +
      `${withEmail} cuentan con un email público de contacto. ` +
      `El relevamiento evidencia oportunidades concretas de mejora en la presencia digital de los comercios de la zona.\n\n` +
      `🔍 Conocé el servicio Lead Finder Pro: https://marianoaliandri.com.ar/keywords`
    );
    setMsg(''); setSavedUrl(null); setSavedId(null);
    setModal(true);
  };

  const publicar = async () => {
    setBusy(true); setMsg('');
    try {
      let auditoriaId = savedId;
      // Si el informe ya se guardó (falló solo la parte de redes), no se duplica: solo se reintenta redes.
      if (!savedUrl || !auditoriaId) {
        const resp = await fetch('/api/auditorias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(), summary: desc.trim(), results: filas,
            stats: { total, withEmail, lowSeoCount: low, avgSeoScore: avg },
            config: { ciudades, pais: 'Argentina', radioKm: form.radioKm, tiposLabels: rubros },
          }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.id) throw new Error(data.error || 'Error al publicar');
        auditoriaId = data.id;
        setSavedId(auditoriaId);
        setSavedUrl(`/auditorias/${auditoriaId}`);
      }
      const informeUrl = `/auditorias/${auditoriaId}`;

      const networks = Object.keys(nets).filter(k => nets[k]);
      if (toSocial && networks.length) {
        const res = await fetch('/api/publish-social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildAuditPublishPayload({ caption: `${title}\n\n${desc}`, networks, auditoriaId })),
        });
        const pub = await res.json().catch(() => ({}));
        if (!res.ok || pub.success === false) {
          setMsg(`falló la publicación en redes: ${pub.error || `HTTP ${res.status}`}`);
          setBusy(false);
          return;
        }
      }
      setUrl(informeUrl);
      setModal(false);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold">Ver informe</a>;
  }

  const puede = total >= MIN_SITIOS_INFORME;
  return (
    <>
      <button onClick={abrir} disabled={disabled || !puede}
        title={puede ? undefined : `Hacen falta al menos ${MIN_SITIOS_INFORME} leads con web y puntaje SEO (hay ${total})`}
        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold">
        Publicar informe ({total})
      </button>
      {!puede && !disabled && <span className="text-xs text-fg-500">Mínimo {MIN_SITIOS_INFORME} sitios con web para publicar</span>}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (busy) return; if (savedUrl) setUrl(savedUrl); setModal(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="pub-title" className="bg-card text-fg rounded-2xl border border-fg/10 w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 id="pub-title" className="font-semibold mb-1">Publicar auditoría</h3>
            <p className="text-xs text-fg-500 mb-4">Incluye solo los {total} leads con web. Revisá el título y la descripción.</p>
            <label htmlFor="pub-t" className="block text-[11px] font-bold uppercase tracking-widest text-fg-500 mb-1">Título</label>
            <input id="pub-t" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} className="w-full mb-4 px-3 py-2 bg-page border border-fg/10 rounded-lg text-sm" />
            <label htmlFor="pub-d" className="block text-[11px] font-bold uppercase tracking-widest text-fg-500 mb-1">Descripción del informe</label>
            <textarea id="pub-d" value={desc} onChange={e => setDesc(e.target.value)} rows={6} disabled={busy} className="w-full px-3 py-2 bg-page border border-fg/10 rounded-lg text-sm leading-relaxed resize-y" />
            <div className="mt-4 p-3 rounded-xl bg-fg/5 border border-fg/10 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={toSocial} onChange={e => setToSocial(e.target.checked)} className="w-4 h-4" /> Publicar también en redes sociales
              </label>
              {toSocial && (
                <div className="flex gap-4 pl-6">
                  {['linkedin', 'instagram', 'facebook'].map(n => (
                    <label key={n} className="flex items-center gap-1.5 text-xs text-fg-400 capitalize">
                      <input type="checkbox" checked={nets[n]} onChange={() => setNets(p => ({ ...p, [n]: !p[n] }))} className="w-3.5 h-3.5" /> {n}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {msg && (
              <p className="mt-3 text-sm text-red-500" role="alert">
                {savedUrl && <>Informe guardado: <a href={savedUrl} target="_blank" rel="noopener noreferrer" className="underline">Ver informe</a>, pero </>}{msg}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { if (savedUrl) setUrl(savedUrl); setModal(false); }} disabled={busy} className="px-4 py-2 text-sm text-fg-400 hover:bg-fg/5 rounded-lg">Cancelar</button>
              <button onClick={publicar} disabled={busy || !title.trim()} className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
                {busy ? 'Publicando…' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
