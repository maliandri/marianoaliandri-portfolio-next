'use client';

// src/hooks/useFirebaseStats.js
// 🔄 Custom hooks para datos de Firebase con React Query y validación Zod
import { useQuery, useMutation } from '@tanstack/react-query';
import { FirebaseAnalyticsService } from '../utils/firebaseservice';
import { queryKeys, invalidateStats } from '../utils/queryClient';
import { safeValidate, extendedStatsSchema, basicStatsSchema } from '../schemas/firebaseSchemas';
import { useState, useEffect } from 'react';

// Instancia compartida del servicio
let firebaseService = null;

function getFirebaseService() {
  if (!firebaseService) {
    firebaseService = new FirebaseAnalyticsService();
  }
  return firebaseService;
}

/**
 * Hook para estadísticas básicas con actualizaciones en tiempo real
 * Combina React Query para cache con suscripción Firebase para real-time
 */
export function useBasicStats() {
  const service = getFirebaseService();
  const [realtimeStats, setRealtimeStats] = useState(null);

  // Query inicial para cargar datos con validación
  const query = useQuery({
    queryKey: queryKeys.stats.basic,
    queryFn: async () => {
      await service.recordVisit();
      const rawData = await service.getExtendedStats();
      // Validar datos con Zod
      return safeValidate(extendedStatsSchema, rawData);
    },
    staleTime: 30000, // 30 segundos
  });

  // Suscripción a actualizaciones en tiempo real con validación
  useEffect(() => {
    const cleanup = service.subscribeToStats((basicStats) => {
      const validated = safeValidate(basicStatsSchema, basicStats);
      setRealtimeStats(validated);
    });

    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [service]);

  // Combinar datos de cache con datos en tiempo real
  return {
    ...query,
    data: realtimeStats ? { ...query.data, ...realtimeStats } : query.data,
  };
}

/**
 * Hook para estadísticas extendidas
 * Incluye páginas más visitadas, productos, etc.
 */
export function useExtendedStats() {
  const service = getFirebaseService();

  return useQuery({
    queryKey: queryKeys.stats.extended,
    queryFn: async () => {
      const rawData = await service.getExtendedStats();
      return safeValidate(extendedStatsSchema, rawData);
    },
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para registrar una visita
 */
export function useRecordVisit() {
  const service = getFirebaseService();

  return useMutation({
    mutationFn: () => service.recordVisit(),
    onSuccess: () => {
      invalidateStats();
    },
  });
}

/**
 * Hook para registrar visualización de página
 */
export function useTrackPageView() {
  const service = getFirebaseService();

  return useMutation({
    mutationFn: ({ path, title }) => service.trackPageView(path, title),
    onSuccess: () => {
      invalidateStats();
    },
  });
}

/**
 * Hook para dar like
 */
export function useLike() {
  const service = getFirebaseService();

  return useMutation({
    mutationFn: () => service.recordLike(),
    onSuccess: () => {
      invalidateStats();
    },
  });
}

/**
 * Hook para dar dislike
 */
export function useDislike() {
  const service = getFirebaseService();

  return useMutation({
    mutationFn: () => service.recordDislike(),
    onSuccess: () => {
      invalidateStats();
    },
  });
}

/**
 * Hook para obtener conteo de usuarios registrados
 */
export function useRegisteredUsersCount() {
  const service = getFirebaseService();

  return useQuery({
    queryKey: queryKeys.stats.registeredUsers,
    queryFn: () => service.getRegisteredUsersCount(),
    staleTime: 120000, // 2 minutos
  });
}

/**
 * Hook para datos de visitantes únicos
 */
export function useUniqueVisitors() {
  return useQuery({
    queryKey: queryKeys.stats.visitors,
    queryFn: async () => {
      // Fallback a localStorage si Firebase no está disponible
      const savedVisits = localStorage.getItem('siteVisits');
      return savedVisits ? parseInt(savedVisits) : 0;
    },
    staleTime: 300000, // 5 minutos
  });
}
