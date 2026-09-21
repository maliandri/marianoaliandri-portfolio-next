'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import LeadFinderUsagePanel from './LeadFinderUsagePanel';
import LeadFinderPlansManager from './LeadFinderPlansManager';
import AnaliticaPlansEditor from './AnaliticaPlansEditor';

function getAdminPassword() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '';
}

const SHEET_LFP = 'Lead Finder Pro';
const SHEET_ANA = 'Analitica';
const ANALITICA_IDS = ['free', 'basico', 'full'];

export default function PlansManager() {
  const [section, setSection] = useState('planes'); // 'uso' | 'planes'
  const [importMsg, setImportMsg] = useState(null);
  const [importing, setImporting] = useState(false);
  const lfpRef = useRef(null);
  const anaRef = useRef(null);
  const fileInputRef = useRef(null);

  const exportExcel = () => {
    const lfpPlans = lfpRef.current?.getPlans() || [];
    const anaPlans = anaRef.current?.getPlans() || [];

    const lfpRows = lfpPlans.map(p => ({
      id: p.id, Nombre: p.name, Alcance: p.scope, Facturacion: p.billingType,
      Creditos: p.credits, PrecioARS: p.priceARS, Activo: p.active ? 'SI' : 'NO',
      Descripcion: p.description || '', Orden: p.orden ?? p.order ?? 99,
    }));
    const anaRows = anaPlans.map(p => ({
      id: p.id, Nombre: p.name, PrecioARS: p.price, Cuota: p.limit ?? '',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lfpRows), SHEET_LFP);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(anaRows), SHEET_ANA);
    XLSX.writeFile(wb, `planes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    const adminPassword = getAdminPassword();
    let created = 0, updated = 0, skipped = 0, errors = [];

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // --- Lead Finder Pro: crea si no trae id, actualiza si trae id ---
      if (wb.SheetNames.includes(SHEET_LFP)) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_LFP]);
        for (const row of rows) {
          const plan = {
            name: row.Nombre || row.name, scope: row.Alcance || row.scope || 'localidad',
            billingType: row.Facturacion || row.billingType || 'subscription',
            credits: Number(row.Creditos ?? row.credits) || 0,
            priceARS: Number(row.PrecioARS ?? row.priceARS) || 0,
            active: String(row.Activo ?? 'SI').toUpperCase() !== 'NO',
            description: row.Descripcion || row.description || '',
            order: Number(row.Orden ?? row.order) || 99,
          };
          if (!plan.name) { skipped++; continue; }
          try {
            if (row.id) {
              const res = await fetch('/api/leadfinder-plans', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPassword, id: row.id, plan }),
              });
              if (!res.ok) throw new Error((await res.json()).error);
              updated++;
            } else {
              const res = await fetch('/api/leadfinder-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPassword, plan }),
              });
              if (!res.ok) throw new Error((await res.json()).error);
              created++;
            }
          } catch (err) {
            errors.push(`${plan.name}: ${err.message}`);
          }
        }
      }

      // --- Analítica: solo actualiza precio/cuota de ids fijos (free/basico/full) ---
      if (wb.SheetNames.includes(SHEET_ANA)) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_ANA]);
        for (const row of rows) {
          if (!ANALITICA_IDS.includes(row.id)) { skipped++; continue; }
          try {
            const res = await fetch('/api/analitica-plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                adminPassword, id: row.id,
                price: Number(row.PrecioARS) || 0,
                limit: row.Cuota === '' || row.Cuota === undefined ? null : Number(row.Cuota),
              }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            updated++;
          } catch (err) {
            errors.push(`${row.id}: ${err.message}`);
          }
        }
      }

      lfpRef.current?.reload();
      anaRef.current?.reload();
      setImportMsg({
        type: errors.length ? 'warn' : 'ok',
        text: `${created} creados, ${updated} actualizados${skipped ? `, ${skipped} sin cambios` : ''}${errors.length ? ` — errores: ${errors.join(' · ')}` : ''}`,
      });
    } catch (err) {
      setImportMsg({ type: 'error', text: 'Error leyendo el Excel: ' + err.message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 dark:border-neutral-800">
        {[['uso', 'Uso de Google Places'], ['planes', 'Planes']].map(([s, label]) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${
              section === s ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'uso' && <LeadFinderUsagePanel />}

      {section === 'planes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-gray-500 max-w-md">
              Exportá los planes de ambos productos a Excel para editar precios/costos cómodo,
              e importá de vuelta para actualizar (o cargar planes nuevos de Lead Finder Pro).
            </p>
            <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                Exportar Excel
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={importing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {importing ? 'Importando...' : 'Importar Excel'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
            </div>
          </div>

          {importMsg && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
              importMsg.type === 'ok' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
              : importMsg.type === 'warn' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
            }`}>
              {importMsg.text}
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Lead Finder Pro</h3>
            <LeadFinderPlansManager ref={lfpRef} />
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Analítica</h3>
            <AnaliticaPlansEditor ref={anaRef} />
          </div>
        </div>
      )}
    </div>
  );
}
