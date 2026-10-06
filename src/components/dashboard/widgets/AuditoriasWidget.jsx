'use client';

function Stat({ value, label, color = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-2xl font-bold ${color}`}>{value ?? '—'}</span>
      <span className="text-[11px] text-gray-400 leading-tight">{label}</span>
    </div>
  );
}

export default function AuditoriasWidget({ data }) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Auditorías SEO</span>
      {data ? (
        <div className="flex gap-5 flex-wrap">
          <Stat value={data.total} label="reportes" color="text-orange-500" />
          <Stat value={data.emailsEnviados} label="emails enviados" color="text-sky-500" />
          <Stat value={data.totalNegocios?.toLocaleString('es-AR')} label="negocios analizados" color="text-gray-700 dark:text-gray-200" />
        </div>
      ) : (
        <span className="text-gray-300 text-sm">—</span>
      )}
    </div>
  );
}
