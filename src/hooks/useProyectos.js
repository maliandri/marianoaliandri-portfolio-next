'use client';

import { useQuery } from '@tanstack/react-query';

export function useProyectos() {
  return useQuery({
    queryKey: ['proyectos'],
    queryFn: async () => {
      const res = await fetch('/api/proyectos');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      return json.proyectos;
    },
    staleTime: 30 * 60 * 1000,  // 30 minutos — screenshots cambian poco
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
