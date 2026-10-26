import { Suspense } from 'react';
import BajaClient from './BajaClient';

export const metadata = {
  title: 'Dejar de recibir mails',
  robots: { index: false, follow: false },
};

// Link del pie de los mails a negocios (src/lib/bizEmail.js). Confirma con un botón para que un
// antivirus que abre los links del mail no dé de baja a nadie sin querer.
export default function BajaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Suspense fallback={null}>
        <BajaClient />
      </Suspense>
    </div>
  );
}
