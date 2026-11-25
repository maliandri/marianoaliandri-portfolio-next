'use client';

import { useEffect, useRef, useState } from 'react';

// Id anónimo de la visita (sessionStorage) + reporte agrupado de lo que va marcando y preguntando, para el aviso a
// Telegram (/api/tienda/sesion/). Sin storage (navegación privada estricta) igual funciona con un id en memoria.
const KEY = 'tienda_sesion_id';
const nuevoId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function useSesionTienda({ servicios, ultimaPregunta }) {
  const [id, setId] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let v = null;
    try { v = sessionStorage.getItem(KEY); } catch { /* sin storage */ }
    if (!v) { v = nuevoId(); try { sessionStorage.setItem(KEY, v); } catch { /* sin storage */ } }
    setId(v);
  }, []);

  useEffect(() => {
    if (!id || (!servicios.length && !ultimaPregunta)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch('/api/tienda/sesion/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ id, servicios, ultimaPregunta }),
      }).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer.current);
  }, [id, servicios, ultimaPregunta]);

  return id;
}
