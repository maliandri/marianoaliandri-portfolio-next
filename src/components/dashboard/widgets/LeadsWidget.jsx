'use client';
import ReactECharts from 'echarts-for-react';

export default function LeadsWidget({ data }) {
  if (!data) return <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">—</div>;

  const porCiudad = data.porCiudad || {};
  const sorted = Object.entries(porCiudad)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const cities = sorted.map(([c]) => c.length > 14 ? c.slice(0, 14) + '…' : c);
  const counts = sorted.map(([, v]) => v);
  const max = counts[0] || 1;

  const option = {
    animation: false,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 11 } },
    grid: { top: 8, bottom: 8, left: 110, right: 44 },
    xAxis: {
      type: 'value', minInterval: 1,
      axisLabel: { fontSize: 9, color: '#9ca3af' },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'category', data: cities,
      axisLabel: { fontSize: 10, color: '#6b7280' },
      axisLine: { show: false }, axisTick: { show: false },
      inverse: true,
    },
    series: [{
      type: 'bar', data: counts,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (params) => {
          const t = params.data / max;
          const r = Math.round(16 + (79 - 16) * (1 - t));
          const g = Math.round(185 - 60 * (1 - t));
          const b = Math.round(129 - 60 * (1 - t));
          return `rgb(${r},${g},${b})`;
        },
      },
      label: { show: true, position: 'right', fontSize: 10, color: '#9ca3af' },
      barMaxWidth: 18,
    }],
  };

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Negocios por ciudad</span>
        <span className="text-xs text-gray-400">{data.totalNegocios?.toLocaleString('es-AR')} total</span>
      </div>
      <div className="flex-1 min-h-0">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </>
  );
}
