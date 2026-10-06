'use client';
export default function AuditoriasWidget({ data }) {
  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Auditorías</p>
      {data ? (
        <div className="flex flex-col gap-1">
          <div className="flex gap-4">
            <div>
              <span className="text-4xl font-bold text-emerald-500">{data.total}</span>
              <span className="block text-xs text-gray-400">reportes</span>
            </div>
            <div>
              <span className="text-4xl font-bold text-blue-500">{data.emailsEnviados}</span>
              <span className="block text-xs text-gray-400">emails enviados</span>
            </div>
          </div>
          <span className="text-xs text-gray-400">{data.totalNegocios} negocios auditados en total</span>
        </div>
      ) : <span className="text-gray-300 text-sm">–</span>}
    </div>
  );
}
