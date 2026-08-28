'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

export function useProyectos(days = 28, lag = 3) {
  return useQuery({
    queryKey: ['proyectos', days, lag],
    queryFn: async () => {
      const res = await fetch(`/api/proyectos?days=${days}&lag=${lag}`);
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
    placeholderData: keepPreviousData,
  });
}
