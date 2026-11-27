'use client';

import { useEffect } from 'react';

// Avisa a Telegram (vía /api/aviso-vista/) que un cliente abrió su link privado. No avisa si este navegador
// es el de Mariano: el admin deja la marca `soyAdmin` en localStorage al entrar (views/AdminPage.jsx).
export function avisarVista(payload) {
  try {
    if (localStorage.getItem('soyAdmin') === '1') return;
  } catch { /* sin storage: avisa igual */ }
  fetch('/api/aviso-vista/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true,
  }).catch(() => {});
}

export default function AvisoVista(props) {
  const key = JSON.stringify(props);
  useEffect(() => { avisarVista(props); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  return null;
}
