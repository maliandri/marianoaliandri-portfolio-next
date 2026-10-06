'use client';
import ReactECharts from 'echarts-for-react';

const AXIS_LABEL = { fontSize: 9, color: '#9ca3af' };

export default function GA4Widget({ data }) {
  if (!data || data.noData) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">GA4</span>
      <p className="text-xs text-gray-400">Tag instalado recientemente — datos disponibles en unos días.</p>
    </div>
  );

  const { serie = [], sesiones = 0, usuarios = 0, paginasVistas = 0 } = data;
  const dates = serie.map(s => s.date.slice(5));
  const sess  = serie.map(s => s.sesiones);
  const users = serie.map(s => s.usuarios);

  const option = {
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 11 },
    },
    legend: {
      data: ['Sesiones', 'Usuarios'],
      bottom: 0,
      textStyle: { fontSize: 10, color: '#9ca3af' },
      itemWidth: 12, itemHeight: 3,
    },
    grid: { top: 8, bottom: 36, left: 40, right: 20 },
    xAxis: {
      type: 'category', data: dates,
      axisLabel: { ...AXIS_LABEL, rotate: 30 },
      axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: AXIS_LABEL,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Sesiones', type: 'line', data: sess, smooth: true,
        symbol: 'none', lineStyle: { color: '#f59e0b', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245,158,11,0.18)' },
              { offset: 1, color: 'rgba(245,158,11,0)' },
            ],
          },
        },
      },
      {
        name: 'Usuarios', type: 'line', data: users, smooth: true,
        symbol: 'none', lineStyle: { color: '#fbbf24', width: 1.5, type: 'dashed' },
        areaStyle: { color: 'rgba(251,191,36,0)' },
      },
    ],
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">GA4 · 28 días</span>
        <span className="text-xs font-semibold text-amber-600">{sesiones.toLocaleString('es-AR')} sesiones</span>
        <span className="text-xs text-gray-400">{usuarios.toLocaleString('es-AR')} usuarios</span>
        <span className="text-xs text-gray-400">{paginasVistas.toLocaleString('es-AR')} vistas</span>
      </div>
      <div className="flex-1 min-h-0">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </>
  );
}
