'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { ExchangeService } from '@/utils/exchangeService';

// Encabezados del Excel (orden de columnas) ↔ claves internas.
const COLUMNS = [
  { header: 'ID',                       key: 'id' },
  { header: 'Nombre',                   key: 'name' },
  { header: 'Descripción',              key: 'descripcion' },
  { header: 'Precio USD',               key: 'precioUSD' },
  { header: 'Tipo de cambio',           key: 'tipoCambio' },
  { header: 'Precio ARS',               key: 'precioARS' },
  { header: 'Alquiler Seña (USD)',      key: 'alquilerSena' },
  { header: 'Alquiler Cuota (USD/mes)', key: 'alquilerCuota' },
  { header: 'Alquiler Duración (meses)',key: 'alquilerDuracion' },
  { header: 'Alquiler Activo (SI/NO)',  key: 'alquilerActivo' },
];

export default function StoreExcelManager() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [summary, setSummary] = useState(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const fileRef = useRef(null);

  const pass = () => sessionStorage.getItem('adminPassword');

  const download = async () => {
    setBusy(true); setMsg(''); setSummary(null);
    try {
      const res = await fetch('/api/store-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', adminPassword: pass() }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Error');

      // Tipo de cambio actual para prellenar la columna (informativo)
      let tc = '';
      try { tc = Math.round(await new ExchangeService().getExchangeRate()); } catch { /* opcional */ }

      const rows = d.products.map((p) => ({
        'ID': p.id,
        'Nombre': p.name,
        'Descripción': p.descripcion,
        'Precio USD': p.precioUSD,
        'Tipo de cambio': tc,
        'Precio ARS': p.precioARS,
        'Alquiler Seña (USD)': p.alquilerSena,
        'Alquiler Cuota (USD/mes)': p.alquilerCuota,
        'Alquiler Duración (meses)': p.alquilerDuracion,
        'Alquiler Activo (SI/NO)': p.alquilerActivo,
      }));

      const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map((c) => c.header) });
      ws['!cols'] = [
        { wch: 24 }, { wch: 28 }, { wch: 50 }, { wch: 11 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tienda');
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `tienda-${fecha}.xlsx`);
      setMsg(`✓ Exportados ${rows.length} productos`);
    } catch (e) {
      setMsg('✕ ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg(''); setSummary(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Mapear encabezados → claves internas
      const rows = raw.map((r) => {
        const out = {};
        for (const col of COLUMNS) out[col.key] = r[col.header] ?? '';
        return out;
      }).filter((r) => String(r.id).trim() !== '');

      if (!rows.length) throw new Error('El archivo no tiene filas con ID');

      if (replaceAll && !confirm(
        `⚠️ REEMPLAZAR TODO\n\nSe van a BORRAR todos los productos actuales de la tienda y ` +
        `cargar los ${rows.length} del Excel en su lugar. Esto no se puede deshacer.\n\n¿Continuar?`
      )) { setBusy(false); if (fileRef.current) fileRef.current.value = ''; return; }

      const res = await fetch('/api/store-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', adminPassword: pass(), rows, replace: replaceAll }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Error');

      setSummary(d);
      setMsg(
        `✓ ${d.deleted ? `${d.deleted} borrados, ` : ''}${d.updated} productos cargados` +
        `${d.rentalUpdated ? `, ${d.rentalUpdated} con alquiler` : ''}`
      );
    } catch (err) {
      setMsg('✕ ' + err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearStore = async () => {
    if (!confirm('⚠️ Se van a BORRAR TODOS los productos de la tienda (compra y alquiler). Esto no se puede deshacer.\n\n¿Vaciar la tienda?')) return;
    setBusy(true); setMsg(''); setSummary(null);
    try {
      const res = await fetch('/api/store-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', adminPassword: pass() }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Error');
      setMsg(`✓ Tienda vaciada (${d.deleted} borrados). Recargá la pestaña para ver el cambio.`);
    } catch (e) {
      setMsg('✕ ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Importar / Exportar tienda (Excel)</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Descargá el Excel con todos los productos, editá precios y descripciones, y volvé a subirlo.
        Al importar se actualiza por <strong>ID</strong>. Si dejás <em>Precio ARS</em> vacío pero cargás
        <em> Tipo de cambio</em>, el ARS se calcula automáticamente (USD × TC).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={download}
          disabled={busy}
          className="px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50 text-sm font-medium"
        >
          Descargar Excel
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          Subir y actualizar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onFile}
          className="hidden"
        />

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replaceAll}
            onChange={(e) => setReplaceAll(e.target.checked)}
            className="w-4 h-4 accent-red-600"
          />
          Reemplazar todo (borra los actuales al subir)
        </label>

        <button
          onClick={clearStore}
          disabled={busy}
          className="px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-sm font-medium"
        >
          Vaciar tienda
        </button>

        {busy && <span className="text-sm text-gray-500">Procesando…</span>}
        {!busy && msg && <span className="text-sm text-gray-700 dark:text-gray-300">{msg}</span>}
      </div>

      {summary?.errors?.length > 0 && (
        <div className="mt-3 text-xs text-orange-600 dark:text-orange-400">
          <p className="font-semibold">Avisos ({summary.errors.length}):</p>
          <ul className="list-disc pl-5">
            {summary.errors.slice(0, 10).map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
