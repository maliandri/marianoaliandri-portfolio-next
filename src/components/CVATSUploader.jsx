'use client';

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ✅ 1. PROPS: Recibe isOpen, onClose y hideFloatingButton del componente padre (Badge Central)
export default function CVATSUploader({ isOpen: isOpenProp, onClose: onCloseProp, hideFloatingButton = false }) {
  // ---------- estado ----------
  // ✅ 2. ESTADO HÍBRIDO: Si el padre controla 'isOpen', lo usa. Si no, usa su propio estado interno.
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenInternal;

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ---------- base URL backend ----------
  const BASE = (
    process.env.NEXT_PUBLIC_ATS_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ""
  ).replace(/\/+$/, "");
  const endpoint = BASE ? `${BASE}/api/analyze-cv` : `/api/analyze-cv`;

  // ---------- deep link abrir al cargar ----------
  useEffect(() => {
    // Solo se activa si NO está controlado por un padre
    if (isOpenProp !== undefined) return;

    const path = window.location.pathname || "";
    const q = new URLSearchParams(window.location.search);
    const hash = (window.location.hash || "").replace("#", "");
    if (hash === "ats" || q.get("tool") === "ats" || path.includes("/analizador-ats")) {
      setIsOpenInternal(true);
    }
  }, [isOpenProp]);

  // ---------- precalentar backend cuando se abre el modal ----------
  useEffect(() => {
    if (isOpen && endpoint) {
      // Hacer un ping silencioso al backend para despertarlo
      console.log('🔥 Precalentando backend...');
      fetch(endpoint.replace('/api/analyze-cv', '/'), {
        method: 'HEAD',
        mode: 'no-cors' // No importa la respuesta, solo queremos despertar el servidor
      }).catch(() => {
        // Ignorar errores, el objetivo es solo despertar el servidor
      });
    }
  }, [isOpen, endpoint]);

  // ✅ 3. FUNCIONES ADAPTADAS: Las funciones de abrir/cerrar ahora respetan el control del padre.
  const openWithUrl = () => {
    // Si está controlado por padre, no hace nada, el padre se encarga.
    if (isOpenProp !== undefined) return; 
    setIsOpenInternal(true);
    const url = new URL(window.location.href);
    url.hash = "ats";
    url.searchParams.set("tool", "ats");
    window.history.replaceState({}, "", url.toString());
  };

  const closeAndCleanUrl = () => {
    if (onCloseProp) {
      onCloseProp(); // El router maneja la URL, no tocar history
      return;
    }
    setIsOpenInternal(false);
    const url = new URL(window.location.href);
    if (url.hash === "#ats") url.hash = "";
    if (url.searchParams.get("tool") === "ats") url.searchParams.delete("tool");
    window.history.replaceState({}, "", url.toString());
  };

  // ... (el resto de la lógica del componente como handleFile, handleNativeShare, etc. permanece igual)
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setLoading(true);
    setResults(null);
    setShowShare(false);
    setCopied(false);
    try {
      const form = new FormData();
      form.append("cv", file);
      form.append("topN", "5");

      console.log('🔄 Enviando CV a:', endpoint);

      const res = await fetch(endpoint, {
        method: "POST",
        body: form,
        mode: 'cors',
        credentials: 'omit'
      });

      let data = null, text = "";
      const ct = res.headers.get("content-type") || "";
      try {
        if (ct.includes("application/json")) data = await res.json();
        else text = await res.text();
      } catch {}
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      if (!data) throw new Error("Respuesta sin JSON del servidor.");
      setResults(data.results || []);
    } catch (e) {
      console.error('❌ Error al analizar CV:', e);
      let errorMsg = "Error al conectar con el servidor de análisis. ";

      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        errorMsg += "El servicio de análisis no está disponible en este momento. Por favor, intentá más tarde o contactame por WhatsApp al +54 299 541-4422.";
      } else if (e.message.includes('CORS')) {
        errorMsg += "Error de configuración del servidor. Por favor, contactame para resolverlo.";
      } else {
        errorMsg += e.message || "Error desconocido al analizar el CV.";
      }

      setErr(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  const best = results?.[0];
  const shareTitle = best
    ? `Mi score ATS: ${best.score}% como ${best.profesion}`
    : "Analizador ATS de CV";
  const shareText = best
    ? `Obtuve ${best.score}% de compatibilidad para ${best.profesion}. Probá tu CV 👇`
    : "Analizá tu CV con este ATS gratuito.";
  const shareUrl = (() => {
    const u = new URL(window.location.href);
    u.hash = "ats";
    u.searchParams.set("tool", "ats");
    return u.toString();
  })();

  async function handleNativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } else {
        setShowShare((s) => !s);
      }
    } catch {}
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(`${shareTitle}\n${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  // Función para crear pago de análisis de CV
  async function handlePayForReport() {
    if (!email) {
      alert('Por favor ingresá tu email para recibir el informe');
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await fetch('/api/cv-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          cvAnalysis: results
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Redirigir a Mercado Pago
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error('No se obtuvo la URL de pago');
      }
    } catch (error) {
      console.error('Error creando pago:', error);
      alert('Hubo un error al procesar el pago. Por favor, intenta de nuevo.');
      setPaymentLoading(false);
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${shareTitle}\n${shareText}\n${shareUrl}`)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const xt = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareTitle} — ${shareText}`)}&url=${encodeURIComponent(shareUrl)}`;

  // ---------- render ----------
  return (
    <>
      {/* ✅ 4. OCULTAR BOTÓN FLOTANTE: Se renderiza solo si 'hideFloatingButton' es false. */}
      {!hideFloatingButton && (
        <motion.button
          onClick={openWithUrl}
          className="fixed bottom-56 left-6 z-40 bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 1.6 }}
          aria-label="Abrir Analizador ATS"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 3a1 1 0 00-1 1v11.5A1.5 1.5 0 004.5 17H16a1 1 0 001-1V4a1 1 0 00-1-1H4zm1 2h10v10H5V5zm2 2h6v2H7V7zm0 3h6v2H7v-2z"/>
          </svg>
          <span className="font-semibold">Analizador ATS</span>
        </motion.button>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
           <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAndCleanUrl} // Se usa la función adaptada
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Analizador de CV — ATS</h2>
                    <p className="text-red-100 mt-1">Subí tu PDF/DOCX y obtené score + skills detectadas</p>
                  </div>
                  <button
                    onClick={closeAndCleanUrl} // Se usa la función adaptada
                    className="text-white hover:text-red-100 transition-colors"
                    aria-label="Cerrar"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* ... (Contenido del modal sin cambios) ... */}
               <div className="p-6 space-y-6">
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cargá tu CV (PDF/DOCX)
                  </label>
                  <input type="file" accept=".pdf,.docx" onChange={handleFile} className="block w-full text-sm"/>
                  <p className="text-xs opacity-70 mt-2">No se guarda el archivo: se procesa en memoria y se descarta.</p>
                </motion.div>
                {loading && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Analizando tu CV…</h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Extrayendo texto y comparando skills</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-3 italic">
                      ⏱️ Si es la primera vez que usás la herramienta hoy, puede tardar hasta 60 segundos (el servidor se está activando)
                    </p>
                  </div>
                )}
                {err && (<motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-600 dark:text-red-400 text-sm whitespace-pre-wrap">{err}</motion.p>)}
                {results && !loading && !err && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    {results.length === 0 ? (<p className="text-sm opacity-80">No se encontraron coincidencias.</p>) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.map((r, i) => (
                          <div key={i} className="bg-white dark:bg-gray-700 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold">{r.profesion}</h3>
                              <span className="text-sm">Score: <b>{r.score}%</b></span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm opacity-80">Skills encontradas ({r.skills_found?.length ?? 0}/{r.skills_total ?? 0}): {r.skills_found?.length ? r.skills_found.join(", ") : "—"}</p>
                              <p className="text-sm opacity-80">Skills faltantes: {r.skills_missing?.length ? r.skills_missing.join(", ") : "—"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-4 pt-2">
                      <div className="relative">
                        <button onClick={handleNativeShare} className="px-4 py-2 rounded-full border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">Compartir</button>
                        <AnimatePresence>
                          {showShare && (
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 w-64 z-50">
                              <p className="text-xs mb-2 opacity-70">Compartí tu resultado:</p>
                              <div className="flex items-center justify-between gap-2">
                                <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1 rounded-full bg-green-500 text-white hover:opacity-90">WhatsApp</a>
                                <a href={li} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1 rounded-full bg-blue-600 text-white hover:opacity-90">LinkedIn</a>
                                <a href={xt} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1 rounded-full bg-gray-900 text-white hover:opacity-90">X</a>
                              </div>
                              <div className="mt-3">
                                <button onClick={handleCopyLink} className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition">{copied ? "¡Copiado!" : "Copiar enlace"}</button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Opción de pago para informe detallado */}
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-900">
                        <div className="text-center mb-4">
                          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">📧 Recibí el Informe por Email</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Tu análisis detallado en tu casilla de correo</p>
                        </div>
                        <div className="space-y-3">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={handlePayForReport}
                            disabled={paymentLoading || !email}
                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                          >
                            {paymentLoading ? 'Procesando...' : '💳 Pagar $1.000 y Recibir Informe'}
                          </button>
                          <p className="text-xs text-center text-gray-500 dark:text-gray-400">Pago seguro con Mercado Pago</p>
                        </div>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-center">
                        <a href="https://cafecito.app/marianoaliandri" rel="noopener noreferrer" target="_blank" className="inline-block">
                          <img srcSet="https://cdn.cafecito.app/imgs/buttons/button_2.png 1x, https://cdn.cafecito.app/imgs/buttons/button_2_2x.png 2x, https://cdn.cafecito.app/imgs/buttons/button_2_3.75x.png 3.75x" src="https://cdn.cafecito.app/imgs/buttons/button_2.png" alt="Invitame un café en cafecito.app" className="mx-auto"/>
                        </a>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
