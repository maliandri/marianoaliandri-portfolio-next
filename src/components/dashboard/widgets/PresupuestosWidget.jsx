'use client';

function Stat({ value, label, color = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-2xl font-bold ${color}`}>{value ?? '—'}</span>
      <span className="text-[11px] text-gray-400 leading-tight">{label}</span>
    </div>
  );
}

export default function PresupuestosWidget({ data }) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Presupuestos</span>
      {data ? (
        <div className="flex gap-5 flex-wrap">
          <Stat value={data.pendientes} label="pendientes" color="text-rose-500" />
          <Stat value={data.total} label="recibidos total" color="text-amber-500" />
          {data.montoTotal > 0 && (
            <Stat
              value={`USD ${data.montoTotal.toLocaleString('es-AR')}`}
              label="asignado total"
              color="text-emerald-600"
            />
          )}
        </div>
      ) : (
        <span className="text-gray-300 text-sm">—</span>
      )}
    </div>
  );
}
