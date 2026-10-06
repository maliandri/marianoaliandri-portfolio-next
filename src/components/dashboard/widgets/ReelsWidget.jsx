'use client';
export default function ReelsWidget({ data }) {
  return (
    <div className="h-full flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reels</p>
      {data ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-4xl font-bold text-indigo-500">{data.esteMes}</span>
          <span className="text-xs text-gray-400">este mes</span>
          <span className="text-sm text-gray-500 mt-1">Total: <strong>{data.total}</strong></span>
        </div>
      ) : <span className="text-gray-300 text-sm">–</span>}
    </div>
  );
}
