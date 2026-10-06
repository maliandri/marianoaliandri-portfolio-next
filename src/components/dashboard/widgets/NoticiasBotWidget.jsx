'use client';
import ReactECharts from 'echarts-for-react';

const NET_LABELS = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X / Twitter' };
const NET_COLORS = { facebook: '#1877f2', instagram: '#e1306c', linkedin: '#0a66c2', x: '#000000' };

export default function NoticiasBotWidget({ data }) {
  if (!data) return <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">—</div>;

  const { ultimos30 = 0, porRed = {}, serie = [] } = data;

  // Por red — horizontal bar
  const nets = Object.entries(porRed)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  const barOption = {
    animation: false,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 11 } },
    grid: { top: 4, bottom: 4, left: 80, right: 36 },
    xAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 9, color: '#9ca3af' }, splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }, axisLine: { show: false } },
    yAxis: {
      type: 'category',
      data: nets.map(([k]) => NET_LABELS[k] || k),
      axisLabel: { fontSize: 10, color: '#6b7280' },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: nets.map(([k, v]) => ({ value: v, itemStyle: { color: NET_COLORS[k] || '#9ca3af', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', fontSize: 10, color: '#9ca3af' },
      barMaxWidth: 18,
    }],
  };

  // Daily sparkline
  const dates = serie.map(s => s.date.slice(5));
  const counts = serie.map(s => s.count);
  const sparkOption = {
    animation: false,
    grid: { top: 2, bottom: 2, left: 2, right: 2 },
    xAxis: { type: 'category', data: dates, show: false },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'bar', data: counts,
      itemStyle: { color: '#0ea5e9', borderRadius: [2, 2, 0, 0] },
      barMaxWidth: 8,
    }],
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bot de noticias · 30 días</span>
        <span className="text-xs font-semibold text-sky-600">{ultimos30} publicaciones</span>
      </div>

      {nets.length > 0 ? (
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex-1 min-h-0" style={{ maxHeight: 120 }}>
            <ReactECharts option={barOption} style={{ height: '100%', width: '100%' }} />
          </div>
          {serie.length > 0 && (
            <div style={{ height: 48 }}>
              <ReactECharts option={sparkOption} style={{ height: '100%', width: '100%' }} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-400">Sin publicaciones en los últimos 30 días</p>
        </div>
      )}
    </>
  );
}
