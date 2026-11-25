'use client';

import { useEffect } from 'react';
import { track } from '@/lib/track';

// Eventos del embudo "presupuesto del cliente": vio la página y tocó pagar.
export function MedirVista({ id }) {
  useEffect(() => { track('ver_presupuesto', { presupuesto_id: id }); }, [id]);
  return null;
}

export function BotonPagar({ href, id, children, className }) {
  return (
    <a href={href} className={className} onClick={() => track('begin_checkout', { presupuesto_id: id })}>{children}</a>
  );
}
