'use client';

import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-white font-semibold mb-0.5">{d.label}</p>
      <p className="text-gray-400">{d.n} sitios · {d.pct}%</p>
    </div>
  );
}

export default function SeoScoreChart({ bands }) {
  const total = bands.reduce((a, b) => a + b.n, 0);

  return (
    <div className="bg-[#111] border border-white/10 rounded-xl p-5 md:p-6 flex flex-col md:flex-row gap-6 items-stretch">
      {/* Gráfico de barras */}
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bands} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {bands.map(b => <Cell key={b.key} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda a la derecha */}
      <div className="flex md:flex-col gap-3 md:gap-2.5 md:justify-center md:w-52 shrink-0 flex-wrap">
        {bands.map(b => (
          <div key={b.key} className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: b.color }} />
            <div className="min-w-0">
              <p className="text-sm text-gray-200 font-medium leading-tight">{b.label}</p>
              <p className="text-xs text-gray-500 leading-tight">
                {b.n} sitios · {total ? Math.round((b.n / total) * 100) : 0}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
