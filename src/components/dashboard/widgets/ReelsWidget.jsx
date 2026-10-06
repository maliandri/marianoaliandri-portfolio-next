'use client';

export default function ReelsWidget({ data }) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reels generados</span>
      {data ? (
        <div className="flex gap-6 items-end">
          <div className="flex flex-col gap-0.5">
            <span className="text-3xl font-bold text-indigo-500">{data.esteMes}</span>
            <span className="text-[11px] text-gray-400">este mes</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xl font-bold text-gray-700 dark:text-gray-200">{data.total}</span>
            <span className="text-[11px] text-gray-400">total histórico</span>
          </div>
        </div>
      ) : (
        <span className="text-gray-300 text-sm">—</span>
      )}
    </div>
  );
}
