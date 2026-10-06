'use client';
import ReactECharts from 'echarts-for-react';
import { useBasicStats } from '@/hooks/useFirebaseStats';

export default function VisitasWidget({ data }) {
  const { data: firebaseData } = useBasicStats();

  const visitas = firebaseData?.totalVisits || firebaseData?.visits || 0;
  const likes   = firebaseData?.totalLikes  || firebaseData?.likes  || 0;

  const sparkOption = {
    grid: { top: 2, bottom: 2, left: 2, right: 2 },
    xAxis: { type: 'category', show: false, data: ['', '', '', '', '', '', ''] },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      data: visitas
        ? [visitas * 0.6, visitas * 0.7, visitas * 0.75, visitas * 0.85, visitas * 0.9, visitas * 0.95, visitas]
        : [0, 0, 0, 0, 0, 0, 0],
      smooth: true,
      color: '#6366f1',
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.1 },
      symbol: 'none',
    }],
  };

  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Visitas</p>
      <div className="flex gap-4 items-end">
        <div>
          <span className="text-4xl font-bold text-indigo-500">{visitas.toLocaleString('es-AR')}</span>
          <span className="block text-xs text-gray-400">únicas</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-pink-400">{likes.toLocaleString('es-AR')}</span>
          <span className="block text-xs text-gray-400">likes ❤</span>
        </div>
      </div>
      <div className="flex-1 min-h-[40px]">
        <ReactECharts option={sparkOption} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
