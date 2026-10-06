'use client';
import ReactECharts from 'echarts-for-react';

export default function LeadsWidget({ data }) {
  if (!data) return <div className="h-full flex items-center justify-center text-gray-300 text-sm">–</div>;

  const porCiudad = data.porCiudad || {};
  const sorted = Object.entries(porCiudad)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const cities = sorted.map(([c]) => c.length > 12 ? c.slice(0, 12) + '…' : c);
  const counts = sorted.map(([, v]) => v);

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 10, bottom: 10, left: 120, right: 30 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: cities, axisLabel: { fontSize: 9 } },
    series: [{ type: 'bar', data: counts, color: '#10b981', label: { show: true, position: 'right', fontSize: 9 } }],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Leads por ciudad</p>
        <span className="text-xs text-gray-400">{data.totalNegocios} total</span>
      </div>
      <div className="flex-1 min-h-0">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
