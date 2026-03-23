'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/firebaseservice';
import priceService from '../../utils/priceService';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

const TECH_GROUPS = {
  Pagos:          ['Integración MercadoPago', 'Pagos recurrentes', 'BindX'],
  Storage:        ['Cloudinary CDN', 'Firebase Storage'],
  IA:             ['Chatbots con Gemini', 'Automatización con IA', 'Generación de contenido'],
  'Bases de datos': ['Firebase Firestore', 'MongoDB Atlas', 'Supabase'],
  Email:          ['Resend transaccional', 'Notificaciones automáticas'],
  Hosting:        ['Deploy en Vercel', 'Netlify Functions'],
  Automatización: ['Flujos con Make.com', 'Webhooks'],
  Video:          ['Canvas Reel Generator', 'Microlink screenshots'],
};

const REDES_OPTIONS = ['LinkedIn', 'FB+IG', 'Todas'];
const TIPO_OPTIONS  = ['Post', 'Reel'];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptySlot() {
  return { id: uid(), hora: '', tipo: 'Post', redes: 'LinkedIn', contenido: null };
}

function emptySchedule() {
  return Object.fromEntries(DIAS.map((d) => [d, []]));
}

export default function CronScheduler() {
  const [schedule, setSchedule]     = useState(emptySchedule());
  const [active, setActive]         = useState(false);
  const [expanded, setExpanded]     = useState({ lunes: true });
  const [products, setProducts]     = useState([]);
  const [projects, setProjects]     = useState([]);
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState(false);
  const [savedOk, setSavedOk]       = useState(false);
  const [loadError, setLoadError]   = useState(null);

  // Cargar productos
  useEffect(() => {
    priceService.getAllPrices().then((all) => {
      setProducts(Object.values(all).filter((p) => p.name));
    });
  }, []);

  // Cargar proyectos
  useEffect(() => {
    fetch('/api/proyectos')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : data?.proyectos || []))
      .catch(() => {});
  }, []);

  // Cargar config desde Firestore
  useEffect(() => {
    getDoc(doc(db, 'cron_schedule', 'config'))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setActive(!!data.active);
        if (data.schedule) setSchedule({ ...emptySchedule(), ...data.schedule });
      })
      .catch(() => setLoadError('No se pudo cargar la configuración'));
  }, []);

  // ── Mutaciones del schedule ──────────────────────────────────────────────

  const addSlot = (dia) => {
    setSchedule((prev) => ({ ...prev, [dia]: [...(prev[dia] || []), emptySlot()] }));
  };

  const removeSlot = (dia, id) => {
    setSchedule((prev) => ({ ...prev, [dia]: prev[dia].filter((s) => s.id !== id) }));
  };

  const updateSlot = (dia, id, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [dia]: prev[dia].map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  };

  const setSlotContenido = (dia, id, contenido) => {
    setSchedule((prev) => ({
      ...prev,
      [dia]: prev[dia].map((s) => (s.id === id ? { ...s, contenido } : s)),
    }));
  };

  // ── Guardar ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSavedOk(false);
    try {
      await setDoc(
        doc(db, 'cron_schedule', 'config'),
        { schedule, active, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle activo ────────────────────────────────────────────────────────

  const handleToggle = async () => {
    setToggling(true);
    const next = !active;
    try {
      await setDoc(
        doc(db, 'cron_schedule', 'config'),
        { active: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setActive(next);
    } catch (e) {
      alert('Error al cambiar estado: ' + e.message);
    } finally {
      setToggling(false);
    }
  };

  // ── Contenido dropdown ──────────────────────────────────────────────────

  const ContenidoSelect = useCallback(({ dia, slot }) => {
    const current = slot.contenido;
    const label = current ? current.nombre : '— Elegir contenido —';

    const handleChange = (e) => {
      const val = e.target.value;
      if (!val) { setSlotContenido(dia, slot.id, null); return; }
      const parsed = JSON.parse(val);
      setSlotContenido(dia, slot.id, parsed);
    };

    const currentVal = current ? JSON.stringify(current) : '';

    return (
      <select
        value={currentVal}
        onChange={handleChange}
        className="flex-1 min-w-0 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1.5 truncate"
      >
        <option value="">— Elegir contenido —</option>

        <optgroup label="📦 Productos">
          {products.map((p) => {
            const val = JSON.stringify({ grupo: 'product', nombre: p.name, data: { productId: p.id, precio: p.priceUSD } });
            return <option key={p.id} value={val}>{p.name}</option>;
          })}
        </optgroup>

        {Object.entries(TECH_GROUPS).map(([cat, items]) => (
          <optgroup key={cat} label={`⚙️ ${cat}`}>
            {items.map((item) => {
              const val = JSON.stringify({ grupo: 'technology', nombre: item, data: { category: cat } });
              return <option key={item} value={val}>{item}</option>;
            })}
          </optgroup>
        ))}

        <optgroup label="🌐 Proyectos">
          {projects.map((p, i) => {
            const val = JSON.stringify({ grupo: 'project', nombre: p.sitio || p.name || p.url, data: { sitio: p.sitio, clicks: p.clicks } });
            return <option key={i} value={val}>{p.sitio || p.name || p.url}</option>;
          })}
        </optgroup>
      </select>
    );
  }, [products, projects]);

  // ── Render ───────────────────────────────────────────────────────────────

  const totalSlots = DIAS.reduce((acc, d) => acc + (schedule[d]?.length || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">⏰ Cron Social</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {totalSlots} publicación{totalSlots !== 1 ? 'es' : ''} programada{totalSlots !== 1 ? 's' : ''} · Timezone: America/Argentina/Buenos_Aires
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Badge estado */}
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            active
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            {active ? '● ACTIVO' : '○ PAUSADO'}
          </span>

          {/* Toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              active
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
            }`}
          >
            {toggling ? '…' : active ? '⏸ Pausar cron' : '▶ Activar cron'}
          </button>

          {/* Guardar */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : savedOk ? '✓ Guardado' : '💾 Guardar semana'}
          </button>
        </div>
      </div>

      {loadError && (
        <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
          ⚠ {loadError}
        </p>
      )}

      {/* Días */}
      <div className="space-y-3">
        {DIAS.map((dia) => {
          const slots = schedule[dia] || [];
          const isOpen = !!expanded[dia];

          return (
            <div key={dia} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              {/* Cabecera del día */}
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [dia]: !isOpen }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    {DIAS_LABEL[dia]}
                  </span>
                  {slots.length > 0 && (
                    <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                      {slots.length} slot{slots.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Slots */}
              {isOpen && (
                <div className="p-3 space-y-2">
                  {slots.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                      Sin publicaciones programadas
                    </p>
                  )}

                  {slots.map((slot) => (
                    <div key={slot.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {/* Hora */}
                      <input
                        type="time"
                        value={slot.hora}
                        onChange={(e) => updateSlot(dia, slot.id, 'hora', e.target.value)}
                        className="w-28 shrink-0 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1.5"
                      />

                      {/* Contenido */}
                      <ContenidoSelect dia={dia} slot={slot} />

                      {/* Tipo */}
                      <select
                        value={slot.tipo}
                        onChange={(e) => updateSlot(dia, slot.id, 'tipo', e.target.value)}
                        className="w-24 shrink-0 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1.5"
                      >
                        {TIPO_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                      </select>

                      {/* Redes */}
                      <select
                        value={slot.redes}
                        onChange={(e) => updateSlot(dia, slot.id, 'redes', e.target.value)}
                        className="w-28 shrink-0 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1.5"
                      >
                        {REDES_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                      </select>

                      {/* Eliminar */}
                      <button
                        onClick={() => removeSlot(dia, slot.id)}
                        className="shrink-0 p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Eliminar slot"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  {slots.length < 10 && (
                    <button
                      onClick={() => addSlot(dia)}
                      className="mt-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium"
                    >
                      + Agregar publicación
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pie */}
      <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1">
        <p>• El cron se ejecuta cada minuto. Solo publica cuando hay un slot con la hora exacta del día actual.</p>
        <p>• Si hay dos slots a la misma hora, se publican con 2 segundos de delay entre sí.</p>
        <p>• Los slots sin hora configurada se ignoran.</p>
      </div>
    </div>
  );
}
