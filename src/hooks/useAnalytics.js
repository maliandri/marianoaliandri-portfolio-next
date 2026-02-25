'use client';

// src/hooks/useAnalytics.js
import { useState, useEffect, useCallback } from 'react';
import { FirebaseAnalyticsService } from '../utils/firebaseservice';

export function useAnalytics() {
  const [analytics] = useState(() => new FirebaseAnalyticsService());
  const [stats, setStats] = useState({
    totalVisits: 0,
    uniqueVisitors: 0,
    likes: 0,
    dislikes: 0
  });
  const [userVote, setUserVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inicializar analytics
  useEffect(() => {
    initializeAnalytics();
  }, []);

  const initializeAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Registrar visita y cargar datos en paralelo
      const [visitResult, statsResult, voteResult] = await Promise.all([
        analytics.recordVisit(),
        analytics.getStats(),
        analytics.getUserVote()
      ]);

      setStats(statsResult);
      setUserVote(voteResult);

    } catch (err) {
      console.error('Error inicializando analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejar votación
  const handleVote = useCallback(async (voteType) => {
    if (loading) return;

    try {
      setLoading(true);
      
      const result = await analytics.handleVote(voteType);
      setUserVote(result);

      // Recargar estadísticas
      const updatedStats = await analytics.getStats();
      setStats(updatedStats);

      return result;
    } catch (err) {
      console.error('Error en votación:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [analytics, loading]);

  // Refrescar estadísticas manualmente
  const refreshStats = useCallback(async () => {
    try {
      setLoading(true);
      const updatedStats = await analytics.getStats();
      setStats(updatedStats);
    } catch (err) {
      console.error('Error refrescando estadísticas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [analytics]);

  // Suscribirse a actualizaciones en tiempo real
  const subscribeToRealTime = useCallback((callback) => {
    return analytics.subscribeToStats(callback);
  }, [analytics]);

  return {
    stats,
    userVote,
    loading,
    error,
    handleVote,
    refreshStats,
    subscribeToRealTime,
    analytics
  };
}

// Hook específico para tracking de eventos
export function useEventTracking() {
  const [analytics] = useState(() => new FirebaseAnalyticsService());

  const trackEvent = useCallback(async (eventName, eventData = {}) => {
    try {
      // Expandir para otros eventos personalizados
      const eventRef = ref(analytics.database, `events/${Date.now()}_${eventName}`);
      await set(eventRef, {
        name: eventName,
        data: eventData,
        timestamp: serverTimestamp(),
        visitorId: analytics.getVisitorId()
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }, [analytics]);

  const trackPageView = useCallback(async (pageName) => {
    await trackEvent('page_view', { page: pageName });
  }, [trackEvent]);

  const trackCalculatorUsage = useCallback(async (calculatorType, step) => {
    await trackEvent('calculator_usage', { 
      type: calculatorType, 
      step: step 
    });
  }, [trackEvent]);

  const trackFormSubmission = useCallback(async (formType, success = true) => {
    await trackEvent('form_submission', { 
      type: formType, 
      success: success 
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
    trackCalculatorUsage,
    trackFormSubmission
  };
}