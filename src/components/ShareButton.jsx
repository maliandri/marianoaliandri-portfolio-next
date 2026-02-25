'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ShareButton Component
 * Botón reutilizable para compartir contenido en redes sociales vía Buffer
 */
function ShareButton({
  content,
  type = 'project',
  variant = 'primary',
  className = '',
  onShare
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);

  const networks = [
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-600' },
    { id: 'twitter', name: 'Twitter', icon: '🐦', color: 'bg-sky-500' },
    { id: 'facebook', name: 'Facebook', icon: '👥', color: 'bg-blue-700' },
    { id: 'instagram', name: 'Instagram', icon: '📸', color: 'bg-pink-600' },
  ];

  const handleShare = async (network) => {
    setIsSharing(true);
    setShareResult(null);

    try {
      // Simular compartir (en producción, esto llamaría a bufferService)
      await new Promise(resolve => setTimeout(resolve, 1500));

      setShareResult({
        success: true,
        network: network.name,
      });

      // Callback opcional
      if (onShare) {
        onShare({ network: network.id, content, type });
      }

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        setIsOpen(false);
        setShareResult(null);
      }, 2000);

    } catch (error) {
      setShareResult({
        success: false,
        error: error.message,
      });
    } finally {
      setIsSharing(false);
    }
  };

  const buttonVariants = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white',
    secondary: 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300',
    minimal: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400',
  };

  return (
    <>
      {/* Botón principal */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium
          transition-all duration-300 shadow-sm hover:shadow-md
          ${buttonVariants[variant]}
          ${className}
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Compartir
      </motion.button>

      {/* Modal de selección de redes */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSharing && setIsOpen(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Compartir en redes
                </h3>
                <button
                  onClick={() => !isSharing && setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  disabled={isSharing}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Preview del contenido */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-medium">
                  Vista previa:
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-3">
                  {content?.text || content?.title || 'Contenido para compartir'}
                </p>
              </div>

              {/* Resultado de compartir */}
              <AnimatePresence>
                {shareResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mb-4 p-3 rounded-lg ${
                      shareResult.success
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}
                  >
                    {shareResult.success ? (
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Compartido en {shareResult.network}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Error: {shareResult.error}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grid de redes sociales */}
              <div className="grid grid-cols-2 gap-3">
                {networks.map((network) => (
                  <motion.button
                    key={network.id}
                    onClick={() => handleShare(network)}
                    disabled={isSharing}
                    className={`
                      ${network.color} text-white p-4 rounded-xl
                      flex items-center gap-3 font-medium
                      transition-all duration-300
                      hover:shadow-lg hover:-translate-y-1
                      disabled:opacity-50 disabled:cursor-not-allowed
                      disabled:hover:transform-none
                    `}
                    whileHover={{ scale: isSharing ? 1 : 1.05 }}
                    whileTap={{ scale: isSharing ? 1 : 0.95 }}
                  >
                    <span className="text-2xl">{network.icon}</span>
                    <span>{network.name}</span>
                    {isSharing && (
                      <div className="ml-auto">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Las publicaciones se programarán automáticamente vía Buffer
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ShareButton;
