'use client';
import { useState, useEffect } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import ReelsWidget from './widgets/ReelsWidget';
import AuditoriasWidget from './widgets/AuditoriasWidget';
import PresupuestosWidget from './widgets/PresupuestosWidget';
import NoticiasBotWidget from './widgets/NoticiasBotWidget';
import LeadsWidget from './widgets/LeadsWidget';
import GSCWidget from './widgets/GSCWidget';
import GA4Widget from './widgets/GA4Widget';
import VisitasWidget from './widgets/VisitasWidget';

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'gsc',          x: 0, y: 0,  w: 6, h: 4 },
    { i: 'ga4',          x: 6, y: 0,  w: 6, h: 4 },
    { i: 'noticias',     x: 0, y: 4,  w: 4, h: 4 },
    { i: 'leads',        x: 4, y: 4,  w: 4, h: 4 },
    { i: 'auditorias',   x: 8, y: 4,  w: 4, h: 3 },
    { i: 'visitas',      x: 0, y: 8,  w: 3, h: 3 },
    { i: 'reels',        x: 3, y: 8,  w: 3, h: 3 },
    { i: 'presupuestos', x: 6, y: 8,  w: 6, h: 3 },
  ],
};

const WIDGET_LABELS = {
  gsc: 'GSC', ga4: 'GA4', noticias: 'Noticias', leads: 'Leads',
  auditorias: 'Auditorías', visitas: 'Visitas', reels: 'Reels', presupuestos: 'Presupuestos',
};

const STORAGE_KEY = 'dashboard_layout_v1';

function loadLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_LAYOUTS;
    const parsed = JSON.parse(saved);
    const defaultIds = new Set(DEFAULT_LAYOUTS.lg.map(i => i.i));
    const savedIds = new Set((parsed.lg || []).map(i => i.i));
    const sameIds = defaultIds.size === savedIds.size && [...defaultIds].every(id => savedIds.has(id));
    return sameIds ? parsed : DEFAULT_LAYOUTS;
  } catch {
    return DEFAULT_LAYOUTS;
  }
}

export default function DashboardGrid({ data }) {
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
  const { width: containerWidth, containerRef } = useContainerWidth();

  useEffect(() => {
    setLayouts(loadLayout());
  }, []);

  function handleLayoutChange(_, allLayouts) {
    setLayouts(allLayouts);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts)); } catch {}
  }

  const widgetContent = {
    gsc:          <GSCWidget data={data?.gsc} />,
    ga4:          <GA4Widget data={data?.ga4} />,
    noticias:     <NoticiasBotWidget data={data?.noticias} />,
    leads:        <LeadsWidget data={data?.auditorias} />,
    auditorias:   <AuditoriasWidget data={data?.auditorias} />,
    visitas:      <VisitasWidget data={data} />,
    reels:        <ReelsWidget data={data?.reels} />,
    presupuestos: <PresupuestosWidget data={data?.presupuestos} />,
  };

  return (
    <div ref={containerRef} style={{ width: '100%', minHeight: 100 }}>
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768 }}
      cols={{ lg: 12, md: 10, sm: 6 }}
      rowHeight={80}
      width={containerWidth || 1200}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".widget-drag-handle"
    >
      {DEFAULT_LAYOUTS.lg.map(({ i }) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col"
        >
          <div className="widget-drag-handle cursor-grab px-4 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-400 select-none flex items-center gap-1">
            <span>⠿</span>
            <span>{WIDGET_LABELS[i] || i}</span>
          </div>
          <div className="flex-1 p-3 overflow-hidden">
            {widgetContent[i] || <p className="text-xs text-gray-400">{i}</p>}
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
    </div>
  );
}
