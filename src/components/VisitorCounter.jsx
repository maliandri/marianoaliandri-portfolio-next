'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FirebaseAnalyticsService } from '../utils/firebaseservice';

function VisitorCounter() {
  const [visitors, setVisitors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firebaseService] = useState(() => new FirebaseAnalyticsService());

  useEffect(() => {
    // Suscribirse a cambios en tiempo real
    const unsubscribe = firebaseService.subscribeToStats((stats) => {
      setVisitors(stats.uniqueVisitors || 0);
      setLoading(false);
    });

    // Limpiar suscripción al desmontar
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [firebaseService]);

  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-2 rounded-full shadow-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      title="Visitantes únicos"
    >
      {/* Icono de ojo */}
      <svg
        className="w-5 h-5 text-blue-600 dark:text-blue-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>

      {/* Contador animado */}
      <motion.span
        className="font-semibold text-sm text-gray-700 dark:text-gray-300 min-w-[2ch]"
        key={visitors}
        initial={{ scale: 1.3, color: '#3b82f6' }}
        animate={{ scale: 1, color: 'currentColor' }}
        transition={{ duration: 0.3 }}
      >
        {loading ? '...' : visitors.toLocaleString()}
      </motion.span>
    </motion.div>
  );
}

export default VisitorCounter;
