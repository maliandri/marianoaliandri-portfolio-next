'use client';

import { useSearchParams } from 'next/navigation';
import LabsPage from '@/views/LabsPage';

// Solo muestra el contenido completo cuando ?screenshot=1
// (para capturas limpias con Microlink sin header ni modal)
// En modo normal el modal LabsTool se encarga de todo.
export default function LabsPageContent() {
  const searchParams = useSearchParams();
  if (searchParams.get('screenshot') !== '1') return null;
  return <LabsPage />;
}
