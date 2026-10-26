// src/components/leadfinder/useLeadSearch.js
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchLeads, normalizarLeadsGuardados, reduceLeadEvent, ESTADO_INICIAL } from '@/lib/leadSearch';

const CERO = { encontrados: 0, examinados: 0, leads: 0, conWeb: 0, descartados: 0 };
const MAX_LOG = 200;
const hora = () => new Date().toLocaleTimeString('es-AR', { hour12: false });

// Corre el motor y guarda el estado de la pantalla. `call` habla con /api/lead-finder-pro/run.
export function useLeadSearch(call) {
  const [phase, setPhase] = useState('idle'); // idle | searching | done | error
  const [leads, setLeads] = useState([]);
  const [pendiente, setPendiente] = useState(null); // negocio que se está revisando ahora
  const [progress, setProgress] = useState({ ciudad: '', etiqueta: '' });
  const [totals, setTotals] = useState(CERO);
  const [avisos, setAvisos] = useState([]);
  const [stop, setStop] = useState(null); // { code, message } si la búsqueda se cortó
  const [log, setLog] = useState([]);
  const cancelRef = useRef(false);
  const leadsRef = useRef([]);
  const accRef = useRef(ESTADO_INICIAL); // estado acumulado de la búsqueda (leads, avisos, totales)
  useEffect(() => () => { cancelRef.current = true; }, []);

  const commit = (fn) => { leadsRef.current = fn(leadsRef.current); setLeads(leadsRef.current); };
  const addLog = (msg, level = 'info') => setLog(prev => [...prev.slice(-(MAX_LOG - 1)), { time: hora(), msg, level }]);

  const run = useCallback(async (params) => {
    cancelRef.current = false;
    commit(() => []);
    setAvisos([]); setStop(null); setPendiente(null); setLog([]);
    setTotals(CERO); setProgress({ ciudad: '', etiqueta: '' });
    setPhase('searching');
    accRef.current = ESTADO_INICIAL;
    let acc = accRef.current;

    try {
      for await (const ev of searchLeads(params, { call, isCancelled: () => cancelRef.current })) {
        // accRef y no una variable local: patchLead (reintento de productos) puede cambiar una fila
        // mientras la búsqueda sigue, y el próximo evento no debe pisar ese cambio.
        acc = accRef.current = reduceLeadEvent(accRef.current, ev);
        switch (ev.type) {
          case 'zona':
            setProgress(p => ({ ...p, ciudad: ev.ciudad }));
            addLog(`Ciudad: ${ev.ciudad}`);
            break;
          case 'busqueda':
            setProgress(p => ({ ...p, etiqueta: ev.etiqueta }));
            addLog(`  Buscando "${ev.etiqueta}"…`);
            break;
          case 'negocio':
            setPendiente(ev.negocio);
            break;
          case 'lead':
            setPendiente(null);
            addLog(`  ✓ ${ev.lead.nombre} (${ev.lead.canal}${ev.lead.seoScore != null ? `, SEO ${ev.lead.seoScore}` : ''})`, 'success');
            break;
          case 'descartado':
            setPendiente(null);
            addLog(`  · ${ev.negocio.nombre}: sin web ni WhatsApp`);
            break;
          case 'aviso':
            setPendiente(null);
            addLog(`  ⚠ ${ev.mensaje}`, 'warn');
            break;
          case 'fin':
            addLog(`Listo: ${acc.totals.leads} leads, ${acc.totals.descartados} descartados.`, 'success');
            break;
          default:
        }
        commit(() => acc.leads);
        setAvisos(acc.avisos);
        setTotals(acc.totals);
      }
      setPhase('done');
    } catch (e) {
      setStop({ code: e.code || null, message: e.message });
      addLog(`Búsqueda cortada: ${e.message}`, 'error');
      setPhase(e.code ? 'done' : 'error');
    }
    setPendiente(null);
    return { leads: leadsRef.current, totals: { ...acc.totals } };
  }, [call]);

  // Actualiza una fila (ej. reintento del conteo de productos).
  const patchLead = useCallback((id, patch) => {
    const a = accRef.current;
    accRef.current = { ...a, leads: a.leads.map(r => (r.id === id ? { ...r, ...patch } : r)) };
    commit(() => accRef.current.leads);
  }, []);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  // Muestra una búsqueda guardada del historial.
  const load = useCallback((saved, savedTotals) => {
    const rows = normalizarLeadsGuardados(saved);
    accRef.current = { ...ESTADO_INICIAL, leads: rows };
    commit(() => rows);
    setTotals(savedTotals || { ...CERO, leads: rows.length, conWeb: rows.filter(l => l.canal === 'web').length });
    setAvisos([]); setStop(null); setLog([]);
    setPhase('done');
  }, []);

  return { phase, leads, pendiente, progress, totals, avisos, stop, log, run, cancel, load, patchLead };
}
