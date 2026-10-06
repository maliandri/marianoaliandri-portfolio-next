'use client';
export default function PresupuestosWidget({ data }) {
  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Presupuestos</p>
      {data ? (
        <div className="flex gap-6">
          <div>
            <span className="text-4xl font-bold text-amber-500">{data.total}</span>
            <span className="block text-xs text-gray-400">recibidos</span>
          </div>
          <div>
            <span className="text-3xl font-bold text-orange-400">{data.pendientes}</span>
            <span className="block text-xs text-gray-400">pendientes</span>
          </div>
          <div>
            <span className="text-xl font-bold text-gray-700 dark:text-gray-200">
              USD {data.montoTotal?.toLocaleString('es-AR') || 0}
            </span>
            <span className="block text-xs text-gray-400">asignado total</span>
          </div>
        </div>
      ) : <span className="text-gray-300 text-sm">–</span>}
    </div>
  );
}
