'use client';

// src/components/BCRADashboardOverlay.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from "recharts";
import { motion } from "framer-motion";

/* ========== utils ========== */
const formatNumber = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + " M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + " K";
  return Number(n).toLocaleString("es-AR");
};

function normalizeSeriesToIndex(points, valueField = "valor") {
  const valid = points.filter((p) => typeof p[valueField] === "number");
  if (!valid.length) return points;
  const base = valid[0][valueField] || 1;
  return points.map((p) => ({ ...p, index: base ? (p[valueField] / base) * 100 : 0 }));
}

function mergeByDate(seriesMap) {
  const allDates = new Set();
  Object.values(seriesMap).forEach((arr) => arr.forEach((p) => allDates.add(p.fecha)));
  const sortedDates = [...allDates].sort();
  return sortedDates.map((fecha) => {
    const row = { fecha };
    for (const [key, arr] of Object.entries(seriesMap)) {
      const found = arr.find((p) => p.fecha === fecha);
      row[key] = found ? found.index : null;
    }
    return row;
  });
}

/* ========== data hooks ========== */
function useBCRA() {
  const [vars, setVars] = useState([]);
  const [error, setError] = useState(null);

  const fetchVars = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/bcra/monetarias`);
      if (!res.ok) throw new Error("BCRA list fetch failed");
      const data = await res.json();
      setVars(data?.results || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const fetchSeries = async (id, { desde, hasta } = {}) => {
    const qs = new URLSearchParams();
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);
    const res = await fetch(`/api/bcra/monetarias/${id}?${qs.toString()}`);
    if (!res.ok) throw new Error("BCRA series fetch failed");
    return await res.json();
  };

  return { vars, fetchVars, fetchSeries, error };
}

function useYahoo() {
  const fetchChart = async (symbol, range = "6mo", interval = "1d") => {
    const res = await fetch(`/api/stocks/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`);
    if (!res.ok) throw new Error("Stocks fetch failed");
    return await res.json();
  };
  return { fetchChart };
}

/* ========== UI partials ========== */
function Overlay({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex">
      <div className="relative bg-white w-full h-full overflow-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-2xl px-4 py-2 shadow-md border bg-white hover:bg-gray-50"
        >
          Cerrar ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="p-4 rounded-2xl shadow-sm border bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

/* ========== main component ========== */
export default function BCRADashboardOverlay() {
  const [open, setOpen] = useState(false);
  const { vars, fetchVars, fetchSeries, error } = useBCRA();
  const { fetchChart } = useYahoo();

  const [selectedMap, setSelectedMap] = useState({});
  const [seriesMap, setSeriesMap] = useState({});
  const [stocks, setStocks] = useState(null);

  useEffect(() => { if (open) fetchVars(); }, [open]);

  useEffect(() => {
    if (!vars.length) return;
    const pick = (keywords) => vars.find((v) => keywords.some((k) => v.descripcion.toLowerCase().includes(k)));

    const sel = {};
    const base = pick(["base monetaria"]);
    if (base) sel.base_monetaria = { idVariable: base.idVariable, descripcion: base.descripcion };

    const dolar = pick([
      "tipo de cambio mayorista vendedor",
      "tipo de cambio vended",
      "tipo de cambio mayorista",
      "a 3500",
      "comunicación a 3500",
    ]);
    if (dolar) sel.dolar = { idVariable: dolar.idVariable, descripcion: dolar.descripcion };

    const infl = vars.find((v) => /ipc|inflación/i.test(v.descripcion));
    if (infl) sel.inflacion = { idVariable: infl.idVariable, descripcion: infl.descripcion };

    setSelectedMap(sel);
  }, [vars]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const desde = new Date(now);
      desde.setFullYear(now.getFullYear() - 3);
      const params = { desde: desde.toISOString(), hasta: now.toISOString() };

      const next = {};
      for (const [key, sel] of Object.entries(selectedMap)) {
        try {
          const d = await fetchSeries(sel.idVariable, params);
          const points = (d?.results || []).map((r) => ({ fecha: r.fecha, valor: Number(r.valor) }));
          next[key] = normalizeSeriesToIndex(points);
        } catch (e) {
          console.error("Series error", key, e);
        }
      }
      setSeriesMap(next);
    })();
  }, [selectedMap]);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchChart("^MERV", "6mo", "1d");
        setStocks(d);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const chartData = useMemo(() => mergeByDate(seriesMap), [seriesMap]);

  const latestCards = useMemo(() => {
    const out = [];
    for (const [key, points] of Object.entries(seriesMap)) {
      if (!points?.length) continue;
      const last = points[points.length - 1];
      const first = points[0];
      const chg = last.index && first.index ? (last.index / first.index - 1) * 100 : 0;
      out.push({
        key,
        value: formatNumber(points[points.length - 1]?.valor),
        hint: `Index 100 → ${last.index?.toFixed(1)}  |  Δ3y ${chg.toFixed(1)}%`,
      });
    }
    return out;
  }, [seriesMap]);

  return (
    <>
      {/* Botón flotante de Panel BCRA (arriba de Estadísticas) */}
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-[340px] left-6 z-40 bg-gradient-to-r from-violet-700 to-fuchsia-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 1.1 }}
        aria-label="Panel BCRA"
        title="Panel BCRA"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v10.5A1.5 1.5 0 0115.5 16H4a1 1 0 01-1-1V4zm3 2h8v2H6V6zm0 3h8v2H6V9zm0 3h5v2H6v-2z"/>
        </svg>
        <span className="font-semibold">Panel BCRA</span>
      </motion.button>

      {/* Overlay */}
      <Overlay open={open} onClose={() => setOpen(false)}>
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Panel BCRA · Variables Apiladas + MERVAL</h1>
            <div className="text-sm text-gray-500">
              Fuente: API BCRA (Monetarias) y Yahoo Finance
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md border">{String(error)}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {latestCards.map((c) => (
              <StatCard key={c.key} label={c.key.replaceAll("_", " ")} value={c.value} hint={c.hint} />
            ))}
            {stocks?.last && (
              <StatCard label="MERVAL" value={formatNumber(stocks.last)} hint={`puntos · range: ${stocks.range || "6mo"}`} />
            )}
          </div>

          <div className="p-4 rounded-2xl border bg-white">
            <div className="mb-3 font-medium">Variables apiladas (índice = 100 en el primer dato de cada serie)</div>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {Object.keys(seriesMap).map((k) => (
                    <Area key={k} type="monotone" dataKey={k} stackId="1" strokeOpacity={0.9} fillOpacity={0.25} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-white">
            <div className="mb-3 font-medium">Índice MERVAL (Yahoo Finance)</div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stocks?.points || []} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="close" strokeOpacity={0.9} fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Nota: “inflación” puede no estar listada en Monetarias; si no aparece, reemplazala por series alternativas
            (ej.: REM o IPC). Este componente autoselecciona por palabras clave y podés ajustar los ids a mano.
          </div>
        </div>
      </Overlay>
    </>
  );
}
