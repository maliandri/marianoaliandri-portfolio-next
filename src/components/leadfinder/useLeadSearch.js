// src/components/leadfinder/useLeadSearch.js
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchLeads } from '@/lib/leadSearch';

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
  useEffect(() => () => { cancelRef.current = true; }, []);

  const commit = (fn) => { leadsRef.current = fn(leadsRef.current); setLeads(leadsRef.current); };
  const addLog = (msg, level = 'info') => setLog(prev => [...prev.slice(-(MAX_LOG - 1)), { time: hora(), msg, level }]);

  const run = useCallback(async (params) => {
    cancelRef.current = false;
    commit(() => []);
    setAvisos([]); setStop(null); setPendiente(null); setLog([]);
    setTotals(CERO); setProgress({ ciudad: '', etiqueta: '' });
    setPhase('searching');
    const local = { ...CERO };

    try {
      for await (const ev of searchLeads(params, { call, isCancelled: () => cancelRef.current })) {
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
            local.examinados++;
            setPendiente(ev.negocio);
            break;
          case 'lead':
            local.leads++;
            if (ev.lead.canal === 'web') local.conWeb++;
            setPendiente(null);
            commit(prev => [...prev, ev.lead]);
            addLog(`  ✓ ${ev.lead.nombre} (${ev.lead.canal}${ev.lead.seoScore != null ? `, SEO ${ev.lead.seoScore}` : ''})`, 'success');
            break;
          case 'descartado':
            local.descartados++;
            setPendiente(null);
            addLog(`  · ${ev.negocio.nombre}: sin web ni WhatsApp`);
            break;
          case 'productos': {
            const { type: _t, id, ...patch } = ev;
            commit(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
            break;
          }
          case 'aviso':
            setPendiente(null);
            setAvisos(a => [...a, ev]);
            addLog(`  ⚠ ${ev.mensaje}`, 'warn');
            break;
          case 'fin':
            Object.assign(local, ev.totals);
            addLog(`Listo: ${local.leads} leads, ${local.descartados} descartados.`, 'success');
            break;
          default:
        }
        setTotals({ ...local });
      }
      setPhase('done');
    } catch (e) {
      setStop({ code: e.code || null, message: e.message });
      addLog(`Búsqueda cortada: ${e.message}`, 'error');
      setPhase(e.code ? 'done' : 'error');
    }
    setPendiente(null);
    return { leads: leadsRef.current, totals: { ...local } };
  }, [call]);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  // Muestra una búsqueda guardada del historial.
  const load = useCallback((saved, savedTotals) => {
    commit(() => saved || []);
    setTotals(savedTotals || { ...CERO, leads: (saved || []).length, conWeb: (saved || []).filter(l => l.canal === 'web' || l.hasWebsite).length });
    setAvisos([]); setStop(null); setLog([]);
    setPhase('done');
  }, []);

  return { phase, leads, pendiente, progress, totals, avisos, stop, log, run, cancel, load };
}
