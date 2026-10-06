'use client';
import { useState } from 'react';

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const MAKE_WEBHOOK = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

function buildSummaryText(data, period) {
  if (!data) return '';
  const noticias = period === 'week'
    ? (data.noticias?.serie || []).slice(-7).reduce((s, d) => s + d.count, 0)
    : data.noticias?.ultimos30 || 0;
  const leads      = data.auditorias?.totalNegocios || 0;
  const auditorias = data.auditorias?.total || 0;
  const reels      = period === 'week' ? data.reels?.esteMes || 0 : data.reels?.total || 0;

  return `${period === 'week' ? 'Esta semana' : 'Este mes'}: ${noticias} noticias publicadas, ${reels} reels generados, ${leads} leads encontrados, ${auditorias} auditorías realizadas.`;
}

export default function DashboardPublisher({ data, gridRef }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState('week');
  const [text, setText] = useState('');
  const [networks, setNetworks] = useState({ linkedin: true, instagram: false, facebook: true });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleOpen() {
    setText(buildSummaryText(data, period));
    setOpen(true);
    setStatus('idle');
    setErrorMsg('');
  }

  function toggleNetwork(net) {
    setNetworks(n => ({ ...n, [net]: !n[net] }));
  }

  async function handlePublish() {
    try {
      setStatus('capturing');
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(gridRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 1,
        backgroundColor: '#f9fafb',
      });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));

      setStatus('uploading');
      const formData = new FormData();
      formData.append('file', blob, 'dashboard.jpg');
      formData.append('upload_preset', 'zone_analysis_images');
      formData.append('folder', 'dashboard_reports');
      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!upRes.ok) throw new Error('Cloudinary upload fallido');
      const { secure_url: imageUrl } = await upRes.json();

      setStatus('sending');
      const makeRes = await fetch(MAKE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'dashboard_report', text, networks, imageUrl }),
      });
      if (!makeRes.ok) throw new Error(`Make.com error ${makeRes.status}`);

      setStatus('done');
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  }

  if (!open) return (
    <button
      onClick={handleOpen}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition"
    >
      Publicar resumen
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Publicar resumen</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex gap-2">
          {['week', 'month'].map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setText(buildSummaryText(data, p)); }}
              className={`px-3 py-1 rounded-full text-sm border transition ${period === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:border-indigo-400'}`}
            >
              {p === 'week' ? 'Última semana' : 'Último mes'}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm dark:bg-gray-700 dark:text-white resize-none"
        />

        <div className="flex gap-3">
          {['linkedin', 'instagram', 'facebook'].map(net => (
            <label key={net} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={networks[net]} onChange={() => toggleNetwork(net)} className="w-4 h-4" />
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{net}</span>
            </label>
          ))}
        </div>

        {status === 'error' && <p className="text-red-500 text-sm">{errorMsg}</p>}
        {status === 'done' && (
          <p className="text-emerald-500 text-sm">
            ¡Publicado! Recordá agregar la rama <code>dashboard_report</code> en Make.com si aún no está.
          </p>
        )}

        <button
          onClick={handlePublish}
          disabled={['capturing', 'uploading', 'sending'].includes(status)}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition"
        >
          {status === 'idle'      && 'Capturar y publicar'}
          {status === 'capturing' && 'Capturando pantalla…'}
          {status === 'uploading' && 'Subiendo imagen…'}
          {status === 'sending'   && 'Enviando a Make.com…'}
          {status === 'done'      && '✓ Publicado'}
          {status === 'error'     && 'Reintentar'}
        </button>
      </div>
    </div>
  );
}
