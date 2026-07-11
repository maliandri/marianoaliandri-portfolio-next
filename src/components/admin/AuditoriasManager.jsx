'use client';

import { useState, useEffect, useCallback } from 'react';

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-gray-500 text-xs">—</span>;
  const cls = score >= 70 ? 'bg-green-500/15 text-green-400 border-green-500/30'
            : score >= 40 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {score}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditoriasManager() {
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [editing, setEditing]       = useState(null);   // { id, title, summary }
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError]   = useState('');
  const [pub, setPub]               = useState(null);   // { id, title }
  const [pubCaption, setPubCaption] = useState('');
  const [pubNets, setPubNets]       = useState({ instagram: true, facebook: true, linkedin: true });
  const [pubSending, setPubSending] = useState(false);
  const [pubMsg, setPubMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/auditorias');
      const data = await res.json();
      setAuditorias(Array.isArray(data) ? data : []);
    } catch { setAuditorias([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Abre el modal de edición: trae el doc completo (incluye summary) y precarga
  const openEdit = async (id) => {
    setEditError('');
    setEditing({ id, title: '', summary: '', loading: true });
    try {
      const res  = await fetch(`/api/auditorias?id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      setEditing({ id, title: data.title || '', summary: data.summary || '', loading: false });
    } catch (e) {
      setEditError(e.message);
      setEditing({ id, title: '', summary: '', loading: false });
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.title.trim()) return;
    setSavingEdit(true); setEditError('');
    try {
      const res = await fetch('/api/auditorias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, title: editing.title.trim(), summary: editing.summary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      // Reflejar el nuevo título en la lista sin recargar todo
      setAuditorias(prev => prev.map(a => a.id === editing.id ? { ...a, title: editing.title.trim() } : a));
      setEditing(null);
    } catch (e) {
      setEditError(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Abre el modal de publicación en redes con un caption autogenerado
  const openPublish = (a) => {
    const ciudades = (a.config?.ciudades || []).join(', ') || 'la zona';
    const total    = a.stats?.total ?? 0;
    const low      = a.stats?.lowSeoCount ?? 0;
    const avg      = a.stats?.avgSeoScore ?? '—';
    const pctLow   = total ? Math.round((low / total) * 100) : 0;
    const reportUrl = `https://marianoaliandri.com.ar/auditorias/${a.id}`;
    setPub({ id: a.id, title: a.title });
    setPubCaption(
`🔍 Analizamos ${total} sitios web en ${ciudades}

📉 ${low} negocios (${pctLow}%) tienen SEO débil — Google casi no los muestra.
📊 Score promedio de la zona: ${avg}/100

Si tenés un local o negocio en la zona, puede que estés en la misma situación sin saberlo.

👇 Mirá el reporte completo y pedí tu análisis gratuito:
${reportUrl}

#SEO #MarketingDigital #PresenciaDigital #NegociosLocales`
    );
    setPubNets({ instagram: true, facebook: true, linkedin: true });
    setPubMsg('');
  };

  const sendPublish = async () => {
    const networks = Object.keys(pubNets).filter(k => pubNets[k]);
    if (!pub || !networks.length || !pubCaption.trim()) return;
    setPubSending(true); setPubMsg('');
    const reportUrl   = `https://marianoaliandri.com.ar/auditorias/${pub.id}`;
    // screenshot=1 oculta navbar/footer/WA; viewport.height corta antes de la tabla
    const screenshotUrl = `${reportUrl}?screenshot=1`;
    const imageUrl    = `https://api.microlink.io/?url=${encodeURIComponent(screenshotUrl)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=980`;
    try {
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // mismo contrato que SocialPublisher (no cambiar nombres de campos)
          text:        pubCaption,
          content:     pubCaption,
          caption:     pubCaption,
          description: pubCaption,
          message:     pubCaption,
          networks,
          type:        'service',
          useAI:       false,
          aiProvider:  'gemini',
          imageUrl,
          url:         imageUrl,
          // Link del reporte en campo aparte: Make lo agrega al final del caption
          link:        reportUrl,
          reportUrl,
          metadata: { topic: 'auditoria', reportUrl, link: reportUrl },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Error al publicar');
      setPubMsg('✓ Enviado a Make');
      setTimeout(() => setPub(null), 1500);
    } catch (e) {
      setPubMsg('✗ ' + e.message);
    } finally {
      setPubSending(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`¿Eliminar "${title}"?\nEsta acción no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      await fetch('/api/auditorias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setAuditorias(prev => prev.filter(a => a.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (e) {
      alert('Error al eliminar: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <span className="animate-pulse">Cargando auditorías...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Auditorías publicadas</h2>
          <p className="text-sm text-gray-500 mt-0.5">{auditorias.length} reporte{auditorias.length !== 1 ? 's' : ''} publicado{auditorias.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
          ↻ Recargar
        </button>
      </div>

      {auditorias.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">📊</p>
          <p>No hay auditorías publicadas todavía.</p>
          <p className="text-xs mt-1">Publicá una desde el Lead Finder.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {auditorias.map(a => (
            <div key={a.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">

              {/* Row principal */}
              <div className="flex items-center gap-4 px-5 py-4">

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{a.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(a.config?.ciudades || []).map(c => (
                      <span key={c} className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                        📍 {c}
                      </span>
                    ))}
                    {a.config?.radioKm && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                        {a.config.radioKm} km
                      </span>
                    )}
                    {(a.config?.tiposLabels || []).slice(0, 5).map(t => (
                      <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                    {(a.config?.tiposLabels || []).length > 5 && (
                      <span className="text-xs text-gray-400 px-1">+{a.config.tiposLabels.length - 5} más</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{formatDate(a.publishedAt)}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{a.stats?.total ?? '—'}</div>
                    <div className="text-xs text-gray-400">sitios</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{a.stats?.lowSeoCount ?? '—'}</div>
                    <div className="text-xs text-gray-400">SEO débil</div>
                  </div>
                  <div className="text-center">
                    <ScoreBadge score={a.stats?.avgSeoScore} />
                    <div className="text-xs text-gray-400 mt-1">prom.</div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpanded(prev => prev === a.id ? null : a.id)}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    {expanded === a.id ? '▲ Menos' : '▼ Más'}
                  </button>
                  <a href={`/auditorias/${a.id}`} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Ver →
                  </a>
                  <button
                    onClick={() => openEdit(a.id)}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => openPublish(a)}
                    className="px-3 py-1.5 text-xs bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors">
                    📣 Publicar
                  </button>
                  <button
                    onClick={() => handleDelete(a.id, a.title)}
                    disabled={deleting === a.id}
                    className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40">
                    {deleting === a.id ? '...' : '🗑 Eliminar'}
                  </button>
                </div>
              </div>

              {/* Panel expandido */}
              {expanded === a.id && (
                <AuditoriaDetail id={a.id} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !savingEdit && setEditing(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Editar auditoría</h3>
              <button onClick={() => setEditing(null)} disabled={savingEdit}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none disabled:opacity-40">✕</button>
            </div>

            {editing.loading ? (
              <p className="text-sm text-gray-500 animate-pulse py-8 text-center">Cargando…</p>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-500 mb-1">Título</label>
                <input
                  value={editing.title}
                  onChange={e => setEditing(ed => ({ ...ed, title: e.target.value }))}
                  disabled={savingEdit}
                  className="w-full mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <label className="block text-xs font-medium text-gray-500 mb-1">Descripción del reporte</label>
                <textarea
                  value={editing.summary}
                  onChange={e => setEditing(ed => ({ ...ed, summary: e.target.value }))}
                  rows={7}
                  disabled={savingEdit}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">Se muestra como “Análisis” en la página pública del reporte.</p>

                {editError && <p className="mt-3 text-xs text-red-500">{editError}</p>}

                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setEditing(null)} disabled={savingEdit}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40">
                    Cancelar
                  </button>
                  <button onClick={saveEdit} disabled={savingEdit || !editing.title.trim()}
                    className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {savingEdit ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de publicación en redes (Make.com) */}
      {pub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !pubSending && setPub(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Publicar en redes</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[380px]">{pub.title}</p>
              </div>
              <button onClick={() => setPub(null)} disabled={pubSending}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none disabled:opacity-40">✕</button>
            </div>

            <label className="block text-xs font-medium text-gray-500 mb-1.5">Redes</label>
            <div className="flex gap-2 mb-4">
              {[['instagram', '📷 Instagram'], ['facebook', '📘 Facebook'], ['linkedin', '💼 LinkedIn']].map(([k, label]) => (
                <button key={k} onClick={() => setPubNets(n => ({ ...n, [k]: !n[k] }))} disabled={pubSending}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors ${pubNets[k]
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-medium text-gray-500 mb-1">Texto de la publicación</label>
            <textarea value={pubCaption} onChange={e => setPubCaption(e.target.value)} rows={9} disabled={pubSending}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <p className="text-[11px] text-gray-400 mt-1">
              Gemini (en Make) pule este texto. El <b>link al reporte</b> se agrega automáticamente al final (campo <code>link</code>).
              La imagen es una captura del reporte (mapa + tabla) vía Microlink.
            </p>

            {pubMsg && <p className={`mt-3 text-xs ${pubMsg.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>{pubMsg}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPub(null)} disabled={pubSending}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={sendPublish} disabled={pubSending || !pubCaption.trim() || !Object.values(pubNets).some(Boolean)}
                className="px-5 py-2 text-sm bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50">
                {pubSending ? 'Enviando…' : '📣 Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SendEmailButton({ neg, auditoriaId }) {
  const [open, setOpen]                   = useState(false);
  const [busy, setBusy]                   = useState(null); // 'generating' | 'sending' | null
  const [sent, setSent]                   = useState(false);
  const [emailText, setEmailText]         = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [source, setSource]               = useState(null); // 'gemini' | 'template' | 'edited'
  const [errorMsg, setErrorMsg]           = useState('');

  const payload = {
    auditoriaId,
    nombre:     neg.nombre,
    siteUrl:    neg.siteUrl,
    email:      neg.email,
    seoScore:   neg.seoScore,
    hasSitemap: neg.hasSitemap,
    hasRobots:  neg.hasRobots,
    metaDesc:   neg.metaDesc,
    hasOG:      neg.hasOG,
    ciudad:     neg.ciudad,
    tipo:       neg.tipo,
  };

  // Paso 1: generar el texto con Gemini (sin enviar) y abrir el preview
  const generate = async () => {
    setBusy('generating'); setErrorMsg('');
    try {
      const resp = await fetch('/api/auditorias/send-biz-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, preview: true }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al generar');
      setEmailText(data.emailText || '');
      setScreenshotUrl(data.screenshotUrl || null);
      setSource(data.source || null);
      setOpen(true);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Paso 2: enviar exactamente el texto que se ve (editado)
  const send = async () => {
    setBusy('sending'); setErrorMsg('');
    try {
      const resp = await fetch('/api/auditorias/send-biz-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, emailText, screenshotUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al enviar');
      setSent(true);
      setOpen(false);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!neg.email) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>;

  return (
    <div className="flex items-center gap-1.5 min-w-[180px]">
      <span className="text-xs text-green-600 dark:text-green-400 truncate max-w-[120px]" title={neg.email}>
        {neg.email}
      </span>
      <button
        onClick={generate}
        disabled={busy === 'generating' || sent}
        title={sent ? 'Enviado' : `Generar email para ${neg.email}`}
        className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium transition-colors
          ${sent               ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default'
          : busy === 'generating' ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-wait'
          : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'}`}>
        {sent ? '✓ Enviado' : busy === 'generating' && !open ? '⏳ Generando…' : '✉ Generar'}
      </button>
      {!open && errorMsg && (
        <span className="text-[10px] text-red-500 max-w-[130px] truncate" title={errorMsg}>{errorMsg}</span>
      )}

      {/* Modal de preview */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Preview del email</h3>
                <p className="text-xs text-gray-500 mt-0.5">Para <strong>{neg.nombre}</strong> · {neg.email}</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={!!busy}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none disabled:opacity-40">✕</button>
            </div>

            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Cuerpo del email (podés editarlo)</label>
              {source === 'gemini'   && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">✨ IA (Gemini)</span>}
              {source === 'template' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" title="Gemini no disponible — se usó una plantilla">✍️ Plantilla</span>}
            </div>
            <textarea
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              rows={10}
              disabled={!!busy}
              className="w-full text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-3 text-gray-700 dark:text-gray-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-y disabled:opacity-60"
            />

            {screenshotUrl && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Captura del sitio que se adjunta</p>
                <img src={screenshotUrl} alt="" className="w-full rounded-xl border border-gray-200 dark:border-neutral-800" />
              </div>
            )}

            {errorMsg && <p className="mt-3 text-xs text-red-500">{errorMsg}</p>}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={generate} disabled={!!busy}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-40">
                {busy === 'generating' ? '↻ Regenerando…' : '↻ Regenerar'}
              </button>
              <button onClick={() => setOpen(false)} disabled={!!busy}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={send} disabled={!!busy || !emailText.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {busy === 'sending' ? 'Enviando…' : `✉ Enviar a ${neg.email}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditoriaDetail({ id }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/auditorias?id=${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 text-xs text-gray-400 animate-pulse">
      Cargando detalle...
    </div>
  );
  if (!data) return null;

  const results = [...(data.results || [])].sort((a, b) => (a.seoScore ?? 999) - (b.seoScore ?? 999));
  const withEmail = results.filter(r => r.email).length;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      {/* Resumen Gemini */}
      {data.summary && (
        <div className="px-5 py-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-2">Análisis Gemini</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{data.summary}</p>
        </div>
      )}

      {/* Info emails */}
      {withEmail > 0 && (
        <div className="px-5 py-2.5 bg-green-50/50 dark:bg-green-900/10 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs text-green-700 dark:text-green-400">
            ✉ <strong>{withEmail}</strong> empresa{withEmail !== 1 ? 's' : ''} con email — hacé click en <strong>Enviar</strong> para mandarles un análisis personalizado generado por Gemini
          </p>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto" style={{ maxHeight: '420px' }}>
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Negocio', 'Ciudad', 'Sitio web', 'Score', 'Sitemap', 'Robots', 'Meta', 'OG', '★', 'Email'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {results.map((neg, i) => (
              <tr key={neg.id || i} className={`hover:bg-gray-50 dark:hover:bg-gray-700/20 ${neg.email ? 'bg-green-50/30 dark:bg-green-900/5' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white max-w-[150px] truncate" title={neg.nombre}>
                  {neg.nombre}
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{neg.ciudad || '—'}</td>
                <td className="px-3 py-2 max-w-[150px]">
                  <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-500 hover:underline truncate block" title={neg.siteUrl}>
                    {(neg.siteUrl || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 30)}
                  </a>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {neg.seoScore != null
                    ? <span className={`font-bold ${neg.seoScore >= 70 ? 'text-green-500' : neg.seoScore >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{neg.seoScore}</span>
                    : <span className="text-gray-400">—</span>}
                </td>
                {['hasSitemap','hasRobots','metaDesc','hasOG'].map(k => (
                  <td key={k} className="px-3 py-2 text-center">
                    {neg[k] == null ? <span className="text-gray-300">—</span>
                      : neg[k] ? <span className="text-green-500">✓</span>
                      : <span className="text-red-400">✗</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-yellow-500 whitespace-nowrap">
                  {neg.rating ? `★ ${neg.rating}` : '—'}
                </td>
                <td className="px-3 py-2">
                  <SendEmailButton neg={neg} auditoriaId={id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
        {results.length} sitios · {withEmail} con email · ordenados por Score SEO ascendente
      </div>
    </div>
  );
}
