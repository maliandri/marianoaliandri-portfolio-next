// src/utils/queryClient.js
// 🔄 Configuración de React Query para data fetching y caching
import { QueryClient } from '@tanstack/react-query';

/**
 * Configuración global de React Query
 * Optimizado para Firebase y APIs externas
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache de 5 minutos por defecto
      staleTime: 5 * 60 * 1000,

      // Mantener datos en cache por 10 minutos después de que no se usen
      gcTime: 10 * 60 * 1000,

      // Reintentar una vez en caso de error
      retry: 1,

      // No refetch automático al enfocar la ventana (Firebase ya tiene real-time)
      refetchOnWindowFocus: false,

      // Handler de errores global
      onError: (error) => {
        console.error('React Query Error:', error);
      },
    },
    mutations: {
      // Handler de errores para mutaciones
      onError: (error) => {
        console.error('Mutation Error:', error);
      },
    },
  },
});

/**
 * Query Keys para organizar el cache
 * Facilita la invalidación y sincronización de datos
 */
export const queryKeys = {
  // Estadísticas
  stats: {
    all: ['stats'],
    basic: ['stats', 'basic'],
    extended: ['stats', 'extended'],
    visitors: ['stats', 'visitors'],
    registeredUsers: ['stats', 'registered-users'],
  },

  // Usuarios
  users: {
    all: ['users'],
    current: ['users', 'current'],
    list: ['users', 'list'],
  },

  // Productos (si aplica para tienda)
  products: {
    all: ['products'],
    list: ['products', 'list'],
    detail: (id) => ['products', 'detail', id],
  },

  // Analytics
  analytics: {
    all: ['analytics'],
    pageViews: ['analytics', 'page-views'],
    topPages: ['analytics', 'top-pages'],
    topProducts: ['analytics', 'top-products'],
  },
};

/**
 * Helper para invalidar queries relacionadas con estadísticas
 */
export async function invalidateStats() {
  await queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
}

/**
 * Helper para invalidar queries de analytics
 */
export async function invalidateAnalytics() {
  await queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

/**
 * Prefetch de datos críticos
 * Útil para precarga de datos que sabemos que el usuario necesitará
 */
export async function prefetchCriticalData() {
  // Ejemplo: prefetch de estadísticas básicas
  // await queryClient.prefetchQuery({
  //   queryKey: queryKeys.stats.basic,
  //   queryFn: () => fetchBasicStats(),
  // });
}
