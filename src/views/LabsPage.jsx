'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { firebaseAuth } from '@/utils/firebaseservice';

const FEATURES = [
  { icon: '📱', title: 'Detecta Android automáticamente', desc: 'Conectás por USB y ya lo reconoce' },
  { icon: '📊', title: 'Mapa de almacenamiento', desc: 'Tabla ordenada por tamaño, con drill-down por carpeta' },
  { icon: '📅', title: 'Vista Año → Mes → Semana', desc: 'Navegá tus archivos organizados por fecha' },
  { icon: '💾', title: 'Backup selectivo', desc: 'Copiá carpetas completas o años enteros al PC' },
  { icon: '🗑️', title: 'Eliminación segura', desc: 'Confirmación obligatoria — no hay accidentes' },
  { icon: '🌐', title: 'Multi-idioma ES / EN', desc: 'Cambia entre español e inglés en tiempo real' },
];

const REQUIREMENTS = [
  { text: <><strong>Windows 10 / 11</strong> — portable .exe, no requiere instalación</> },
  { text: <><strong>Activar Depuración USB</strong> en el celular: Ajustes → Opciones de desarrollador → Depuración USB</> },
  { text: <><strong>Autorizar la PC</strong> cuando el teléfono muestre el popup "¿Permitir depuración USB?"</> },
  { text: <><strong>Cable USB</strong> con soporte de datos (no solo carga)</> },
];

export default function LabsPage() {
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

  const handleLogin = async () => {
    setAuthLoading(true);
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
      if (!res.ok) throw new Error(data.error || 'Error al obtener el link de descarga');

      // Disparar descarga
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

  return (
    <div className="min-h-screen pt-20 pb-20">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 py-10 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-xl">
              <span className="text-4xl">🧪</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">
            Mariano Aliandri Labs
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Herramientas de escritorio desarrolladas por Mariano Aliandri.
            Descargalas gratis, usalas offline.
          </p>
        </motion.div>
      </div>

      {/* Tool card */}
      <div className="max-w-3xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          {/* Card header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg flex-shrink-0 text-3xl">
              🔪
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Navaja Suiza by Maliandri</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-gray-400">v1.0.0</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Windows</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Portable .exe</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">Gratis</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Descripción */}
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              Herramienta de escritorio para analizar y gestionar el almacenamiento de tu celular Android
              directamente desde la PC. Conectás el teléfono por USB, ves exactamente qué ocupa espacio,
              navegás tus archivos por año y mes, hacés backups selectivos y eliminás archivos sin tocar el teléfono.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50"
                >
                  <span className="text-xl flex-shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{f.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Requisitos */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-3">
                Requisitos previos
              </p>
              <ul className="space-y-2">
                {REQUIREMENTS.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                    <span className="mt-0.5 text-amber-500">✓</span>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cómo activar opciones de desarrollador */}
            <details className="mb-6 group">
              <summary className="cursor-pointer text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors list-none flex items-center gap-2">
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-90 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                ¿Cómo activar las Opciones de desarrollador en Android?
              </summary>
              <div className="mt-3 pl-6 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                <p>1. Abrí <strong className="text-gray-800 dark:text-gray-200">Ajustes</strong> en tu celular Android</p>
                <p>2. Ir a <strong className="text-gray-800 dark:text-gray-200">Acerca del teléfono</strong></p>
                <p>3. Tocá <strong className="text-gray-800 dark:text-gray-200">"Número de compilación"</strong> 7 veces seguidas hasta ver el mensaje <em>"Ya sos desarrollador"</em></p>
                <p>4. Volvé a Ajustes → ahora hay una sección <strong className="text-gray-800 dark:text-gray-200">"Opciones de desarrollador"</strong></p>
                <p>5. Activá el toggle <strong className="text-gray-800 dark:text-gray-200">"Depuración USB"</strong> dentro de esa sección</p>
                <p>6. Al conectar el cable, aparece un popup en el teléfono — elegí <strong className="text-gray-800 dark:text-gray-200">"Permitir"</strong></p>
              </div>
            </details>

            {/* Download CTA */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              {authLoading ? (
                <div className="flex items-center justify-center gap-3 py-4">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Verificando sesión...</span>
                </div>
              ) : !user ? (
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                    Para descargar la aplicación iniciá sesión con tu cuenta de Google.
                    Registramos la descarga para poder notificarte de actualizaciones.
                  </p>
                  <motion.button
                    onClick={handleLogin}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-3 px-6 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow hover:shadow-md transition-all text-gray-700 dark:text-gray-200 font-medium"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Iniciar sesión con Google para descargar
                  </motion.button>
                </div>
              ) : (
                <div>
                  {/* Usuario logueado */}
                  <div className="flex items-center gap-3 mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-9 h-9 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {user.displayName?.[0] || '?'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{user.displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      {error}
                    </p>
                  )}

                  {downloadDone ? (
                    <div className="flex items-center justify-center gap-3 py-4 px-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">¡Descarga iniciada!</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500">Tu descarga fue registrada. Te avisaremos si hay actualizaciones.</p>
                      </div>
                    </div>
                  ) : (
                    <motion.button
                      onClick={handleDownload}
                      disabled={downloading}
                      whileHover={downloading ? {} : { scale: 1.02, y: -1 }}
                      whileTap={downloading ? {} : { scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
                    >
                      {downloading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Preparando descarga...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Descargar Navaja Suiza v1.0.0
                        </>
                      )}
                    </motion.button>
                  )}
                  <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
                    Portable — no requiere instalación · Solo Windows 10/11
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Más herramientas pronto */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center"
        >
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Más herramientas en camino · Labs es un proyecto en desarrollo activo
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            Desarrollado por{' '}
            <a
              href="https://marianoaliandri.com.ar"
              className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              marianoaliandri.com.ar
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
