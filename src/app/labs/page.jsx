import { Suspense } from 'react';
import LabsPageContent from './LabsPageContent';

export const metadata = {
  title: 'Labs | Mariano Aliandri — Herramientas de escritorio',
  description:
    'Descargá herramientas de escritorio desarrolladas por Mariano Aliandri. Primera entrega: Navaja Suiza — gestión de almacenamiento Android desde la PC.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/labs/' },
  openGraph: {
    title: 'Mariano Aliandri Labs — Herramientas de escritorio gratuitas',
    description:
      'Navaja Suiza: analizá y gestioná el almacenamiento de tu celular Android directamente desde la PC. Portable, gratis y sin instalación.',
    url: 'https://marianoaliandri.com.ar/labs/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

// Suspense requerido por useSearchParams dentro de LabsPageContent
export default function LabsRoute() {
  return (
    <Suspense fallback={null}>
      <LabsPageContent />
    </Suspense>
  );
}
