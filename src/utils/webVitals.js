// src/utils/webVitals.js
// 📊 Web Vitals - Monitoreo de rendimiento del sitio
import { onCLS, onLCP, onFCP, onTTFB, onINP } from 'web-vitals';

/**
 * Envía métricas de Web Vitals a Firebase Analytics
 * @param {Object} metric - Métrica de Web Vitals
 */
function sendToAnalytics(metric) {
  const { name, value, rating, delta, id } = metric;

  // Log en desarrollo
  if (import.meta.env.MODE === 'development') {
    console.log(`📊 Web Vital [${name}]:`, {
      value: Math.round(value),
      rating,
      delta: Math.round(delta),
      id,
    });
  }

  // Enviar a Firebase Analytics si está disponible
  if (window.gtag) {
    window.gtag('event', name, {
      value: Math.round(value),
      metric_id: id,
      metric_value: value,
      metric_delta: delta,
      metric_rating: rating,
    });
  }

  // Log de métricas pobres
  if (rating === 'poor') {
    console.warn(`⚠️ Poor Web Vital: ${name} = ${Math.round(value)}ms`);
  }

  // Enviar a tu propio analytics (Firebase Firestore)
  try {
    // Opcional: Guardar en Firestore para análisis histórico
    const webVitalsData = {
      metric: name,
      value: Math.round(value),
      rating,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.pathname,
    };

    // Guardar en localStorage para no perder datos
    const vitalsHistory = JSON.parse(localStorage.getItem('webVitals') || '[]');
    vitalsHistory.push(webVitalsData);

    // Mantener solo las últimas 50 métricas
    if (vitalsHistory.length > 50) {
      vitalsHistory.shift();
    }

    localStorage.setItem('webVitals', JSON.stringify(vitalsHistory));
  } catch (error) {
    console.error('Error saving web vitals:', error);
  }
}

/**
 * Inicializa el monitoreo de Web Vitals
 * Mide las métricas Core Web Vitals de Google
 */
export function initWebVitals() {
  // CLS - Cumulative Layout Shift
  // Mide la estabilidad visual (cuánto se mueve el contenido)
  // Bueno: < 0.1, Necesita mejora: 0.1-0.25, Pobre: > 0.25
  onCLS(sendToAnalytics);

  // INP - Interaction to Next Paint (reemplaza FID que fue deprecado)
  // Mide la latencia de todas las interacciones
  // Bueno: < 200ms, Necesita mejora: 200-500ms, Pobre: > 500ms
  onINP(sendToAnalytics);

  // LCP - Largest Contentful Paint
  // Mide cuándo se carga el elemento más grande visible
  // Bueno: < 2.5s, Necesita mejora: 2.5-4s, Pobre: > 4s
  onLCP(sendToAnalytics);

  // FCP - First Contentful Paint
  // Mide cuándo aparece el primer contenido
  // Bueno: < 1.8s, Necesita mejora: 1.8-3s, Pobre: > 3s
  onFCP(sendToAnalytics);

  // TTFB - Time to First Byte
  // Mide el tiempo de respuesta del servidor
  // Bueno: < 800ms, Necesita mejora: 800-1800ms, Pobre: > 1800ms
  onTTFB(sendToAnalytics);

  console.log('📊 Web Vitals: Monitoreo iniciado');
}

/**
 * Obtiene el historial de Web Vitals guardado
 * @returns {Array} Historial de métricas
 */
export function getWebVitalsHistory() {
  try {
    return JSON.parse(localStorage.getItem('webVitals') || '[]');
  } catch {
    return [];
  }
}

/**
 * Calcula el promedio de una métrica específica
 * @param {string} metricName - Nombre de la métrica (CLS, LCP, etc.)
 * @returns {number} Promedio de la métrica
 */
export function getAverageMetric(metricName) {
  const history = getWebVitalsHistory();
  const metrics = history.filter(m => m.metric === metricName);

  if (metrics.length === 0) return 0;

  const sum = metrics.reduce((acc, m) => acc + m.value, 0);
  return Math.round(sum / metrics.length);
}

/**
 * Obtiene el rating general del sitio basado en Web Vitals
 * @returns {string} 'good', 'needs-improvement', 'poor'
 */
export function getOverallRating() {
  const history = getWebVitalsHistory();
  if (history.length === 0) return 'unknown';

  const ratings = history.map(m => m.rating);
  const poorCount = ratings.filter(r => r === 'poor').length;
  const goodCount = ratings.filter(r => r === 'good').length;

  if (poorCount > history.length / 3) return 'poor';
  if (goodCount > history.length / 2) return 'good';
  return 'needs-improvement';
}
