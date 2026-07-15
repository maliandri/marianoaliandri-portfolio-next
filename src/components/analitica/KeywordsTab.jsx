'use client';

import KeywordExplorer from '@/components/audit/KeywordExplorer';

// Envuelve el KeywordExplorer forzando el tema oscuro (.dark) para que combine
// con el fondo negro del panel de Analítica, independientemente del tema global.
export default function KeywordsTab() {
  return (
    <div className="dark">
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Descubrí qué rubros y servicios busca la gente en Google en cualquier localidad de
        Argentina. Elegí una zona y analizá la demanda de búsqueda real, con las frases exactas
        que usa la gente. Fuente: autocompletado de Google.
      </p>
      <KeywordExplorer embedded />
    </div>
  );
}
