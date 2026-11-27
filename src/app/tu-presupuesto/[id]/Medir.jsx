'use client';

import { useEffect } from 'react';
import { track } from '@/lib/track';
import { avisarVista } from '@/components/AvisoVista';

// Eventos del embudo "presupuesto del cliente": vio la página y tocó pagar (+ aviso a Telegram).
export function MedirVista({ id, t }) {
  useEffect(() => {
    track('ver_presupuesto', { presupuesto_id: id });
    avisarVista({ tipo: 'presupuesto', id, t });
  }, [id, t]);
  return null;
}

export function BotonPagar({ href, id, t, children, className }) {
  return (
    <a href={href} className={className} onClick={() => { track('begin_checkout', { presupuesto_id: id }); avisarVista({ tipo: 'pagar', id, t }); }}>{children}</a>
  );
}
