'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { firebaseAuth } from '@/utils/firebaseservice';

const FEATURES = [
  { icon: '📱', title: 'Detecta Android automáticamente', desc: 'Conectás por USB y ya lo reconoce' },
  { icon: '📊', title: 'Mapa de almacenamiento', desc: 'Tabla ordenada por tamaño, con drill-down por carpeta' },
  { icon: '📅', title: 'Vista Año → Mes → Semana', desc: 'Navegá tus archivos organizados por fecha' },
  { icon: '💾', title: 'Backup selectivo', desc: 'Copiá carpetas completas o años enteros al PC' },
  { icon: '🗑️', title: 'Eliminación segura', desc: 'Confirmación obligatoria — no hay accidentes' },
  { icon: '🌐', title: 'Multi-idioma ES / EN', desc: 'Cambia entre español e inglés en tiempo real' },
];

export default function LabsTool({ isOpen: isOpenProp, onClose, hideFloatingButton = false }) {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenInternal;

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = firebaseAuth.onAuthChange((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleClose = () => {
    if (onClose) onClose();
    else setIsOpenInternal(false);
  };

  const handleLogin = async () => {
    await firebaseAuth.loginWithGoogle();
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const rawUser = firebaseAuth.getCurrentUser();
      if (!rawUser) throw new Error('Usuario no autenticado');
      const token = await rawUser.getIdToken();

      const res = await fetch('/api/download-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toolId: 'navaja-suiza' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener el link');

      const a = document.createElement('a');
      a.href = data.url;
      a.download = 'Navaja_Suiza_Maliandri.exe';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 6000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  // Floating button (cuando no está controlado por providers)
  if (!hideFloatingButton && !isOpen) {
    return (
      <motion.button
        onClick={() => setIsOpenInternal(true)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
        title="Labs — Herramientas de escritorio"
      >
        <span className="text-xl">🧪</span>
        <span className="text-sm font-semibold hidden sm:block">Labs</span>
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700"
          >
            {/* Header del modal */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-gray-800 to-gray-900 px-5 py-4 flex items-center gap-4 border-b border-gray-700 rounded-t-2xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-2xl shadow flex-shrink-0">
                🔪
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-white">Navaja Suiza by Maliandri</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-700/50">v1.0.0</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400">Windows</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-400">Portable .exe</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/60 text-orange-400">Gratis</span>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 space-y-5">
              {/* Descripción */}
              <p className="text-gray-300 text-sm leading-relaxed">
                Herramienta de escritorio para analizar y gestionar el almacenamiento de tu celular Android
                directamente desde la PC. Conectás el teléfono por USB, ves exactamente qué ocupa espacio,
                hacés backups selectivos y eliminás archivos sin tocar el teléfono.
              </p>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEATURES.map((f) => (
                  <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-gray-800/60">
                    <span className="text-lg flex-shrink-0">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-200">{f.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Requisitos */}
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-400 mb-2">Requisitos previos</p>
                <ul className="space-y-1.5 text-sm text-amber-300/80">
                  {[
                    <><strong className="text-amber-200">Windows 10 / 11</strong> — portable .exe, no requiere instalación</>,
                    <><strong className="text-amber-200">Activar Depuración USB</strong>: Ajustes → Opciones de desarrollador → Depuración USB</>,
                    <><strong className="text-amber-200">Autorizar la PC</strong> cuando aparezca el popup en el teléfono</>,
                    <><strong className="text-amber-200">Cable USB</strong> con soporte de datos (no solo carga)</>,
                  ].map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">✓</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA descarga */}
              <div className="border-t border-gray-700 pt-4">
                {authLoading ? (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">Verificando sesión...</span>
                  </div>
                ) : !user ? (
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-3">
                      Iniciá sesión con Google para descargar — registramos la descarga para notificarte actualizaciones.
                    </p>
                    <motion.button
                      onClick={handleLogin}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-gray-700 border border-gray-600 rounded-xl shadow hover:shadow-md transition-all text-gray-200 font-medium text-sm"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Iniciar sesión con Google
                    </motion.button>
                  </div>
                ) : (
                  <div>
                    {error && (
                      <p className="text-sm text-red-400 mb-3 p-3 bg-red-900/20 rounded-lg">{error}</p>
                    )}
                    {downloadDone ? (
                      <div className="flex items-center justify-center gap-3 py-3 px-5 bg-emerald-900/20 border border-emerald-700/40 rounded-xl">
                        <span className="text-xl">✅</span>
                        <div>
                          <p className="font-semibold text-emerald-400 text-sm">¡Descarga iniciada!</p>
                          <p className="text-xs text-emerald-600">Registramos tu descarga.</p>
                        </div>
                      </div>
                    ) : (
                      <motion.button
                        onClick={handleDownload}
                        disabled={downloading}
                        whileHover={downloading ? {} : { scale: 1.02, y: -1 }}
                        whileTap={downloading ? {} : { scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-lg text-base transition-all"
                      >
                        {downloading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Preparando descarga...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Descargar Navaja Suiza v1.0.0
                          </>
                        )}
                      </motion.button>
                    )}
                    <p className="text-xs text-center text-gray-600 mt-2">
                      Portable — no requiere instalación · Solo Windows 10/11
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
