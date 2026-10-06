'use client';
import ReactECharts from 'echarts-for-react';

export default function GA4Widget({ data }) {
  if (!data || data.noData) return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">GA4</p>
      <p className="text-xs text-gray-400">Sin datos aún — el tag fue instalado recientemente.</p>
    </div>
  );

  const { serie = [], sesiones = 0, usuarios = 0, paginasVistas = 0 } = data;
  const dates = serie.map(s => s.date.slice(5));
  const sess  = serie.map(s => s.sesiones);
  const users = serie.map(s => s.usuarios);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Sesiones', 'Usuarios'], bottom: 0, textStyle: { fontSize: 10 } },
    grid: { top: 10, bottom: 40, left: 50, right: 20 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: 'Sesiones', type: 'line', data: sess,  smooth: true, color: '#f59e0b' },
      { name: 'Usuarios', type: 'line', data: users, smooth: true, color: '#fcd34d' },
    ],
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-4 mb-1 items-center flex-wrap">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">GA4</p>
        <span className="text-xs text-gray-500">{sesiones.toLocaleString('es-AR')} sesiones</span>
        <span className="text-xs text-gray-500">{usuarios.toLocaleString('es-AR')} usuarios</span>
        <span className="text-xs text-gray-500">{paginasVistas.toLocaleString('es-AR')} pág. vistas</span>
      </div>
      <div className="flex-1 min-h-0">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
