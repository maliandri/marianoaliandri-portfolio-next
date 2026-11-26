import { permanentRedirect } from 'next/navigation';

// El listado público de auditorías se sacó el 2026-11-26: cada informe es privado y se abre solo con
// su link (/auditorias/<id>/?k=<clave>&para=<negocio>), que Mariano le manda a cada negocio.
export default function AuditoriasPage() {
  permanentRedirect('/');
}
