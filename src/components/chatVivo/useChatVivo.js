'use client';

import { useEffect, useRef, useState } from 'react';

// Lado del cliente del chat en vivo: una vez que el cliente escribió, consulta /api/chat-vivo/ cada pocos
// segundos y entrega lo que va escribiendo Mariano (onMensaje). Deja de consultar con la pestaña oculta y
// después de 30 minutos sin novedades.
const POLL_MS = 5000;
const INACTIVO_MS = 30 * 60000;

export function nuevoChatId(prefijo) {
  const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `${prefijo}_${rnd.slice(0, 24)}`;
}

export function useChatVivo({ chatId, activo, onMensaje }) {
  const [estado, setEstado] = useState('ia');
  const desde = useRef(0);
  const ultimaNovedad = useRef(0);
  const cb = useRef(onMensaje);
  useEffect(() => { cb.current = onMensaje; }, [onMensaje]);

  useEffect(() => {
    if (!chatId || !activo) return undefined;
    // Mariano no puede escribir antes de que exista el chat (primer mensaje del cliente): arrancar desde ahora alcanza.
    if (!desde.current) desde.current = Date.now() - 60000;
    ultimaNovedad.current = Date.now();
    let vivo = true;
    const tick = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimaNovedad.current > INACTIVO_MS) return;
      try {
        const res = await fetch(`/api/chat-vivo/?id=${encodeURIComponent(chatId)}&desde=${desde.current}`, { cache: 'no-store' });
        if (!res.ok || !vivo) return;
        const d = await res.json();
        setEstado(d.estado || 'ia');
        for (const m of d.mensajes || []) {
          desde.current = Math.max(desde.current, m.ms);
          ultimaNovedad.current = Date.now();
          cb.current?.(m.texto);
        }
      } catch { /* sin red: se reintenta en el próximo tick */ }
    };
    const t = setInterval(tick, POLL_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [chatId, activo]);

  // Cuando el cliente escribe, se "despierta" la consulta.
  const avisarActividad = () => { ultimaNovedad.current = Date.now(); };
  return { estado, avisarActividad };
}
