'use client';

import { useState, useEffect, useCallback } from 'react';
import TopicCard from './TopicCard';
import { useAuthUser } from '@/hooks/useAuthUser';

const ADMIN_EMAIL_HINT = 'yo@marianoaliandri.com.ar';

const DAYS = [
  ['lun', 'Lunes'], ['mar', 'Martes'], ['mie', 'Miércoles'], ['jue', 'Jueves'],
  ['vie', 'Viernes'], ['sab', 'Sábado'], ['dom', 'Domingo'],
];

const ALL_DAYS_UNRESTRICTED = Object.fromEntries(
  DAYS.map(([key]) => [key, { enabled: true, startHour: null, endHour: null }])
);

function HourSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      disabled={disabled}
      className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 disabled:opacity-50"
    >
      <option value="">--</option>
      {Array.from({ length: 25 }, (_, h) => (
        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
      ))}
    </select>
  );
}

export default function NoticiasBotManager() {
  const { user, loading: authLoading, getIdToken, login } = useAuthUser();
  const [topics, setTopics]     = useState([]);
  const [config, setConfig]     = useState({ active: true, dailyCap: null, schedule: null });
  const [scheduleDraft, setScheduleDraft] = useState(ALL_DAYS_UNRESTRICTED);
  const [log, setLog]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [capInput, setCapInput] = useState('');
  const [busy, setBusy]         = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Las rutas /api/noticias/topics y /config exigen el idToken de Firebase del admin.
  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getIdToken();
    return fetch(url, {
      ...options,
      headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }, [getIdToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [tRes, cRes, lRes] = await Promise.all([
        authFetch('/api/noticias/topics'),
        authFetch('/api/noticias/config'),
        fetch('/api/noticias'),
      ]);
      const [tData, cData, lData] = await Promise.all([tRes.json(), cRes.json(), lRes.json()]);
      if (!tRes.ok) throw new Error(tData.error || 'No se pudieron cargar los tópicos');
      if (!cRes.ok) throw new Error(cData.error || 'No se pudo cargar la configuración');
      setTopics(tData.topics || []);
      setConfig({ active: cData.active !== false, dailyCap: cData.dailyCap ?? null, schedule: cData.schedule ?? null });
      setScheduleDraft(cData.schedule || ALL_DAYS_UNRESTRICTED);
      setCapInput(cData.dailyCap != null ? String(cData.dailyCap) : '');
      setLog(lData.noticias || []);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    load();
  }, [load, user, authLoading]);

  const toggleActive = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !config.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, active: data.active }));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveCap = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const dailyCap = capInput.trim() === '' ? null : Number(capInput);
      const res = await authFetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyCap }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, dailyCap: data.dailyCap }));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: scheduleDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, schedule: data.schedule }));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addTopic = async () => {
    if (!newLabel.trim()) return;
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/noticias/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), query: newQuery.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewLabel(''); setNewQuery('');
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = async (id, activo) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/noticias/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveTone = async (id, toneInstructions) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/noticias/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, toneInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteTopic = async (topic) => {
    const topicNotes = log.filter(n => n.topicId === topic.id);
    const ok = window.confirm(
      `Vas a borrar el tópico "${topic.label}" y sus ${topicNotes.length} notas publicadas en el sitio. ` +
      `No se puede deshacer. Los posts que ya se publicaron en Facebook/LinkedIn/Instagram no se borran — esto solo afecta tu sitio.`
    );
    if (!ok) return;

    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/noticias/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: topic.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || (user && loading)) return <div className="p-6 text-sm text-gray-400 animate-pulse">Cargando...</div>;

  if (!user) {
    return (
      <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          ⚠️ Iniciá sesión con <strong>{ADMIN_EMAIL_HINT}</strong> para administrar el bot de noticias.
        </p>
        <button onClick={login} className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Noticias (Bot)</h2>
        <p className="text-xs text-gray-500">Corre cada hora en GitHub Actions, fuera de Vercel. No se publica nada acá — es control del bot.</p>
      </div>

      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

      {/* Interruptor general + tope diario */}
      <div className="flex flex-wrap items-center gap-6 bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.active} disabled={busy} onChange={toggleActive} />
          <span className={config.active ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-500'}>
            {config.active ? 'Bot activo' : 'Bot pausado'}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Tope diario</label>
          <input
            type="number" min="1" value={capInput}
            onChange={e => setCapInput(e.target.value)}
            placeholder="sin tope"
            className="w-20 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5"
          />
          <button onClick={saveCap} disabled={busy}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </div>

      {/* Horario de publicación */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Horario de publicación</p>
        <div className="space-y-1.5">
          {DAYS.map(([key, dayLabel]) => {
            const day = scheduleDraft[key];
            return (
              <div key={key} className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-gray-800/40 rounded-lg px-3 py-2">
                <label className="flex items-center gap-1.5 w-24 shrink-0">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={e => setScheduleDraft(s => ({ ...s, [key]: { ...s[key], enabled: e.target.checked } }))}
                  />
                  <span className={day.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>{dayLabel}</span>
                </label>
                <span className="text-gray-400">desde</span>
                <HourSelect
                  value={day.startHour}
                  disabled={!day.enabled}
                  onChange={v => setScheduleDraft(s => ({ ...s, [key]: { ...s[key], startHour: v } }))}
                />
                <span className="text-gray-400">hasta</span>
                <HourSelect
                  value={day.endHour}
                  disabled={!day.enabled}
                  onChange={v => setScheduleDraft(s => ({ ...s, [key]: { ...s[key], endHour: v } }))}
                />
              </div>
            );
          })}
        </div>
        <button onClick={saveSchedule} disabled={busy}
          className="mt-2 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50">
          Guardar horario
        </button>
        <p className="text-[11px] text-gray-400 mt-1">
          "--" en desde/hasta = sin restricción de hora ese día. Un día sin tildar = no publica nada ese día.
        </p>
      </div>

      {/* Agregar tópico */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Tópicos a seguir</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Ej: inteligencia artificial"
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 flex-1 min-w-[160px]"
          />
          <input
            type="text" value={newQuery} onChange={e => setNewQuery(e.target.value)}
            placeholder="query de búsqueda (opcional, si difiere del nombre)"
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 flex-1 min-w-[200px]"
          />
          <button onClick={addTopic} disabled={busy || !newLabel.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            + Agregar
          </button>
        </div>

        {/* Tópicos, uno por tarjeta */}
        <div className="space-y-2">
          {topics.length === 0 && <p className="text-xs text-gray-400">Sin tópicos todavía.</p>}
          {topics.map(t => (
            <TopicCard
              key={t.id}
              topic={t}
              notes={log.filter(n => n.topicId === t.id && n.status === 'published')}
              busy={busy}
              onToggleActivo={toggleTopic}
              onSaveTone={saveTone}
              onDelete={deleteTopic}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
