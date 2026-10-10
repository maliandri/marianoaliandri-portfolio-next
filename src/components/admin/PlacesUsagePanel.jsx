'use client';

import { useState, useEffect, useMemo } from 'react';
import { buildUsageReport } from '@/lib/placesUsage';
import { PLACES_LIMITS } from '@/data/placesFreeTier';

const MONTH_FMT = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_FMT = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function lastMonths(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

function barColor(pct) {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function UsageBar({ label, used, projected, free }) {
  const pct = Math.min(100, Math.round((used / free) * 100));
  const projPct = Math.min(100, Math.round((projected / free) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
        <span className="text-gray-500 dark:text-gray-400 tabular-nums">
          {used.toLocaleString('es-AR')} / {free.toLocaleString('es-AR')}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-gray-300 dark:bg-gray-600" style={{ width: `${projPct}%` }} title="Proyección a fin de mes" />
        <div className={`absolute inset-y-0 left-0 ${barColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PlacesUsagePanel() {
  const months = useMemo(() => lastMonths(6), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch('/api/places-usage/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: sessionStorage.getItem('adminPassword'), month }),
    })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
        setRows(data.rows || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [month]);

  const today = new Date().toISOString().slice(0, 10);
  const report = useMemo(
    () => buildUsageReport(rows, { month, today, limits: PLACES_LIMITS }),
    [rows, month, today],
  );

  const isCurrent = month === today.slice(0, 7);
  const freeDetails = PLACES_LIMITS.details.free;
  const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';

  return (
    <div className="space-y-5 max-w-4xl">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Consumo de Google Places</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Cada comercio auditado usa 1 detalle. Google regala {freeDetails.toLocaleString('es-AR')} detalles por mes.
            </p>
          </div>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 capitalize"
          >
            {months.map(m => (
              <option key={m} value={m}>{MONTH_FMT.format(new Date(`${m}-01T00:00:00Z`))}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Stat label="Comercios auditados" value={report.totals.details} />
          <Stat label="Te quedan gratis" value={report.restantes} tone={report.restantes === 0 ? 'text-red-600' : 'text-emerald-600'} />
          <Stat label={isCurrent ? 'Proyección fin de mes' : 'Total del mes'} value={report.proyeccion.details} />
          <Stat
            label={isCurrent ? 'Costo estimado del mes' : 'Costo estimado'}
            value={`USD ${report.costoEstimadoUSD.toLocaleString('es-AR')}`}
            tone={report.costoEstimadoUSD > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}
          />
        </div>

        <div className="space-y-3 mt-5">
          {Object.entries(PLACES_LIMITS).map(([kind, lim]) => (
            <UsageBar key={kind} label={lim.label} used={report.totals[kind]} projected={report.proyeccion[kind]} free={lim.free} />
          ))}
          {isCurrent && (
            <p className="text-[11px] text-gray-400">La parte gris de cada barra es la proyección a fin de mes al ritmo actual.</p>
          )}
        </div>
      </div>

      <div className={`${card} p-0 overflow-hidden`}>
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Cargando…</p>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : report.days.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Sin consumo registrado este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Fecha</th>
                  <th className="text-right font-semibold px-4 py-2.5">Comercios</th>
                  <th className="text-right font-semibold px-4 py-2.5">Búsquedas</th>
                  <th className="text-right font-semibold px-4 py-2.5">Usados en el mes</th>
                  <th className="text-right font-semibold px-4 py-2.5">Te quedan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 tabular-nums">
                {report.days.map(d => (
                  <tr key={d.date} className="text-gray-800 dark:text-gray-200">
                    <td className="px-4 py-2 capitalize">{DAY_FMT.format(new Date(`${d.date}T00:00:00Z`))}</td>
                    <td className="px-4 py-2 text-right">{d.comercios}</td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{d.busquedas}</td>
                    <td className="px-4 py-2 text-right">{d.acumulado.toLocaleString('es-AR')}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${d.restantes === 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {d.restantes.toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-900/40 font-semibold text-gray-900 dark:text-white tabular-nums">
                <tr>
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right">{report.totals.details}</td>
                  <td className="px-4 py-2.5 text-right">{report.totals.searchText + report.totals.searchNearby}</td>
                  <td className="px-4 py-2.5 text-right">{report.totals.details.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-2.5 text-right">{report.restantes.toLocaleString('es-AR')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 max-w-3xl">
        Los datos salen del contador interno del Lead Finder (Lead Finder manual, mapa de leads y auditoría automática), por día UTC.
        Los cupos y precios son estimados y se editan en src/data/placesFreeTier.js. La factura real está en Google Cloud → Facturación.
      </p>
    </div>
  );
}

function Stat({ label, value, tone = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-1 tabular-nums ${tone}`}>
        {typeof value === 'number' ? value.toLocaleString('es-AR') : value}
      </p>
    </div>
  );
}
