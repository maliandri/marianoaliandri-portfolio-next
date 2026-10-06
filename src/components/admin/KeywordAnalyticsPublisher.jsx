'use client';
import { useState, useMemo, useRef } from 'react';
import { PROVINCIAS_AR } from '@/data/localidadesAR';

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const MAKE_WEBHOOK = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

function interesColor(v) {
  if (v >= 66) return '#10b981';
  if (v >= 33) return '#f59e0b';
  return '#f87171';
}

export default function KeywordAnalyticsPublisher() {
  const [provincia, setProvincia] = useState('Neuquén');
  const [localidad, setLocalidad] = useState('Neuquén');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // publish state
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('idle'); // idle|capturing|uploading|sending|done|error
  const [publishError, setPublishError] = useState('');
  const [networks, setNetworks] = useState({ linkedin: true, instagram: true, facebook: true });

  const cardRef = useRef(null);

  const localidades = useMemo(
    () => PROVINCIAS_AR.find(p => p.provincia === provincia)?.localidades || [],
    [provincia]
  );

  const creds = useMemo(() => {
    if (typeof window === 'undefined') return {};
    return {
      adminUsername: sessionStorage.getItem('adminUsername') || '',
      adminPassword: sessionStorage.getItem('adminPassword') || '',
    };
  }, []);

  async function handleSearch() {
    setLoading(true);
    setError('');
    setData(null);
    setPublishStatus('idle');
    try {
      const res = await fetch('/api/keyword-explorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localidad, provincia, ...creds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleNet(n) {
    setNetworks(prev => ({ ...prev, [n]: !prev[n] }));
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishStatus('capturing');
    setPublishError('');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        backgroundColor: '#0f172a',
      });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));

      setPublishStatus('uploading');
      const form = new FormData();
      form.append('file', blob, 'keyword-report.jpg');
      form.append('upload_preset', 'zone_analysis_images');
      form.append('folder', 'keyword_reports');
      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: form,
      });
      if (!upRes.ok) throw new Error('Error al subir imagen a Cloudinary');
      const { secure_url: imageUrl } = await upRes.json();

      setPublishStatus('sending');
      const top10 = (data.results || []).slice(0, 5).map(r => r.label).join(', ');
      const caption = `📊 Rubros más buscados en ${data.localidad}, ${data.provincia}:\n${top10}\n\n🔍 Análisis de demanda real de búsqueda local. #SEOLocal #MarketingDigital`;
      const makeRes = await fetch(MAKE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'keyword_report', text: caption, networks, imageUrl }),
      });
      if (!makeRes.ok) throw new Error(`Make.com respondió ${makeRes.status}`);
      setPublishStatus('done');
    } catch (e) {
      setPublishError(e.message);
      setPublishStatus('error');
    } finally {
      setPublishing(false);
    }
  }

  const top10 = (data?.results || []).filter(r => r.count > 0).slice(0, 10);
  const maxInteres = top10[0]?.interes || 1;

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-gray-800 dark:text-white mb-4">Análisis de rubros buscados</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Provincia</label>
            <select
              value={provincia}
              onChange={e => { setProvincia(e.target.value); setLocalidad(PROVINCIAS_AR.find(p => p.provincia === e.target.value)?.localidades[0] || ''); }}
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            >
              {PROVINCIAS_AR.map(p => <option key={p.provincia}>{p.provincia}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Localidad</label>
            <select
              value={localidad}
              onChange={e => setLocalidad(e.target.value)}
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
            >
              {localidades.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
          >
            {loading ? 'Analizando…' : '🔍 Analizar'}
          </button>
        </div>
        {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
      </div>

      {/* Resultados + tarjeta publicable */}
      {data && top10.length > 0 && (
        <div className="space-y-4">
          {/* Tarjeta capturable */}
          <div
            ref={cardRef}
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: 16, padding: 28, minWidth: 480 }}
          >
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                Rubros más buscados en
              </p>
              <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
                {data.localidad}, {data.provincia}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top10.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#64748b', fontSize: 13, width: 20, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 14, width: 160, flexShrink: 0 }}>{r.label}</span>
                  <div style={{ flex: 1, background: '#1e293b', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(r.interes / maxInteres) * 100}%`,
                        height: '100%',
                        background: interesColor(r.interes),
                        borderRadius: 4,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 12, width: 30, textAlign: 'right' }}>{r.interes}</span>
                </div>
              ))}
            </div>

            <p style={{ color: '#475569', fontSize: 11, marginTop: 16, textAlign: 'right' }}>
              marianoaliandri.com.ar · análisis de demanda de búsqueda local
            </p>
          </div>

          {/* Panel de publicación */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Publicar análisis en redes</h3>
            <div className="flex gap-4 mb-4">
              {['linkedin', 'instagram', 'facebook'].map(n => (
                <label key={n} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={networks[n]} onChange={() => toggleNet(n)} className="w-4 h-4" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{n}</span>
                </label>
              ))}
            </div>
            {publishStatus === 'done' && (
              <p className="text-emerald-500 text-sm mb-3">
                ✓ Publicado. Acordate de agregar la rama <code>keyword_report</code> en Make.com si no la tenés.
              </p>
            )}
            {publishStatus === 'error' && <p className="text-red-500 text-sm mb-3">{publishError}</p>}
            <button
              onClick={handlePublish}
              disabled={publishing || publishStatus === 'done'}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {publishStatus === 'idle'      && '📸 Capturar y publicar'}
              {publishStatus === 'capturing' && 'Capturando imagen…'}
              {publishStatus === 'uploading' && 'Subiendo a Cloudinary…'}
              {publishStatus === 'sending'   && 'Enviando a Make.com…'}
              {publishStatus === 'done'      && '✓ Publicado'}
              {publishStatus === 'error'     && '↩ Reintentar'}
            </button>
          </div>
        </div>
      )}

      {data && top10.length === 0 && (
        <p className="text-gray-500 text-sm">Sin datos de demanda para {data.localidad}. Probá otra localidad.</p>
      )}
    </div>
  );
}
