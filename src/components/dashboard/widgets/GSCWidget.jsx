'use client';
import ReactECharts from 'echarts-for-react';

export default function GSCWidget({ data }) {
  if (!data) return <div className="h-full flex items-center justify-center text-gray-300 text-sm">–</div>;

  const { serie = [], clicks = 0, impresiones = 0, posicion = 0 } = data;
  const dates = serie.map(s => s.date.slice(5));
  const clics = serie.map(s => s.clicks);
  const imps  = serie.map(s => s.impressions);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Clicks', 'Impresiones'], bottom: 0, textStyle: { fontSize: 10 } },
    grid: { top: 10, bottom: 40, left: 50, right: 60 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
    yAxis: [
      { type: 'value', name: 'Clicks', nameTextStyle: { fontSize: 9 } },
      { type: 'value', name: 'Imp.', nameTextStyle: { fontSize: 9 } },
    ],
    series: [
      { name: 'Clicks',      type: 'line', data: clics, smooth: true, color: '#6366f1', yAxisIndex: 0 },
      { name: 'Impresiones', type: 'line', data: imps,  smooth: true, color: '#a5b4fc', yAxisIndex: 1 },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-4 mb-1 items-center flex-wrap">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">GSC</p>
        <span className="text-xs text-gray-500">{clicks.toLocaleString('es-AR')} clicks</span>
        <span className="text-xs text-gray-500">{impresiones.toLocaleString('es-AR')} imp.</span>
        <span className="text-xs text-gray-500">pos. {posicion}</span>
      </div>
      <div className="flex-1 min-h-0">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
