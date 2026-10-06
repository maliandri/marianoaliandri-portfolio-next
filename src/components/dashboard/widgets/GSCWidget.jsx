'use client';
import ReactECharts from 'echarts-for-react';

const AXIS_LABEL = { fontSize: 9, color: '#9ca3af' };

export default function GSCWidget({ data }) {
  if (!data) return <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">—</div>;

  const { serie = [], clicks = 0, impresiones = 0, posicion = 0 } = data;
  const dates = serie.map(s => s.date.slice(5));
  const clics = serie.map(s => s.clicks);
  const imps  = serie.map(s => s.impressions);

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
      data: ['Clicks', 'Impresiones'],
      bottom: 0,
      textStyle: { fontSize: 10, color: '#9ca3af' },
      itemWidth: 12, itemHeight: 3,
    },
    grid: { top: 8, bottom: 36, left: 44, right: 60 },
    xAxis: {
      type: 'category', data: dates,
      axisLabel: { ...AXIS_LABEL, rotate: 30 },
      axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: AXIS_LABEL,
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
        axisLine: { show: false },
      },
      {
        type: 'value',
        axisLabel: AXIS_LABEL,
        splitLine: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Clicks', type: 'line', data: clics, smooth: true,
        yAxisIndex: 0, symbol: 'none',
        lineStyle: { color: '#10b981', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16,185,129,0.18)' },
              { offset: 1, color: 'rgba(16,185,129,0)' },
            ],
          },
        },
      },
      {
        name: 'Impresiones', type: 'line', data: imps, smooth: true,
        yAxisIndex: 1, symbol: 'none',
        lineStyle: { color: '#6366f1', width: 1.5, type: 'dashed' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(99,102,241,0.08)' },
              { offset: 1, color: 'rgba(99,102,241,0)' },
            ],
          },
        },
      },
    ],
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Search Console · 28 días</span>
        <span className="text-xs font-semibold text-emerald-600">{clicks.toLocaleString('es-AR')} clicks</span>
        <span className="text-xs text-gray-400">{impresiones.toLocaleString('es-AR')} imp.</span>
        {posicion > 0 && <span className="text-xs text-gray-400">pos. {posicion}</span>}
      </div>
      <div className="flex-1 min-h-0">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </>
  );
}
