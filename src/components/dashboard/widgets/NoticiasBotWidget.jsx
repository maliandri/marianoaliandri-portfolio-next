'use client';
import ReactECharts from 'echarts-for-react';

export default function NoticiasBotWidget({ data }) {
  if (!data) return <div className="h-full flex items-center justify-center text-gray-300 text-sm">–</div>;

  const { serie = [], ultimos30 = 0 } = data;
  const dates = serie.map(s => s.date.slice(5));

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { top: 10, bottom: 40, left: 40, right: 10 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: 'Noticias', type: 'bar', data: serie.map(s => s.count), color: '#3b82f6', barMaxWidth: 20 },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bot de noticias</p>
        <span className="text-xs text-gray-400">{ultimos30} publicaciones (30d)</span>
      </div>
      <div className="flex-1 min-h-0">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
