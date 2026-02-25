'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Hook para obtener datos de Google Search Console de todas las propiedades
 * @param {number} days - Días de datos a consultar (default: 28)
 */
export function useSearchConsoleStats(days = 28) {
  return useQuery({
    queryKey: ['searchConsole', 'all', days],
    queryFn: async () => {
      const res = await fetch('/api/search-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      return json.data;
    },
    staleTime: 5 * 60 * 1000,  // 5 minutos
    gcTime: 15 * 60 * 1000,    // 15 minutos
    retry: 1,
    refetchOnWindowFocus: false
  });
}
