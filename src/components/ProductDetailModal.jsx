'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { ExchangeService, formatARS, formatUSD } from '../utils/exchangeService';
import { FirebaseAnalyticsService } from '../utils/firebaseservice';

export default function ProductDetailModal({ product, onClose }) {
  const { addToCart } = useCart();
  const [fx, setFx] = useState({ rate: null, loading: true });
  const fxService = new ExchangeService();
  const analyticsRef = useRef(null);

  // Cargar cotización y registrar vista del producto al montar
  useEffect(() => {
    async function loadExchange() {
      try {
        const rate = await fxService.getExchangeRate();
        setFx({ rate, loading: false });
      } catch (error) {
        console.error('Error cargando cotización:', error);
        setFx({ rate: null, loading: false });
      }
    }
    loadExchange();

    // Registrar vista del producto en Firebase
    if (product?.id && product?.name) {
      if (!analyticsRef.current) {
        analyticsRef.current = new FirebaseAnalyticsService();
      }
      analyticsRef.current.trackProductView(product.id, product.name);
    }
  }, [product?.id]);

  if (!product) return null;

  const isCustom = product.priceUSD === null || product.priceUSD === undefined;

  const handleAddToCart = () => {
    addToCart(product);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header con imagen */}
          <div className="relative h-64 bg-gradient-to-br from-purple-600 to-blue-600 overflow-hidden">
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover opacity-40"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

            {/* Botón cerrar */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Título sobre la imagen */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-3xl font-bold mb-2">{product.name}</h2>
              <p className="text-lg text-gray-200">{product.shortDescription}</p>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-8">
            {/* Badges y demo */}
            <div className="flex items-center gap-3 mb-6">
              {product.featured && (
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  ⭐ DESTACADO
                </span>
              )}
              {product.demo && (
                <a
                  href={product.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold flex items-center gap-1"
                >
                  Ver Demo
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            {/* Descripción */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Descripción</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{product.description}</p>
            </div>

            {/* Características */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">¿Qué incluye?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {product.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Entregables y duración */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Duración */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tiempo de entrega
                </h3>
                <p className="text-gray-700 dark:text-gray-300">{product.duration}</p>
              </div>

              {/* Entregables */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Entregables
                </h3>
                <ul className="space-y-1">
                  {product.deliverables.map((item, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Precio y CTA */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                {/* Precio */}
                <div>
                  {isCustom ? (
                    <div>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {product.calculatorLink ? `Desde ${formatUSD(product.priceUSD)}` : 'Cotización Personalizada'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {product.calculatorLink ? 'Usa la calculadora para cotizar' : 'Contactanos para un presupuesto a medida'}
                      </p>
                    </div>
                  ) : fx.loading ? (
                    <div className="text-gray-500 dark:text-gray-400">Cargando precio...</div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {fx.rate ? formatARS(Math.ceil(product.priceUSD * fx.rate)) : formatARS(product.price || product.priceUSD * 1000)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatUSD(product.priceUSD)} • Precio oficial • Pago con Mercado Pago
                      </p>
                    </div>
                  )}
                </div>

                {/* Botones */}
                <div className="flex gap-3">
                  {isCustom ? (
                    <a
                      href="https://wa.me/5492995414422?text=Hola!%20Me%20interesa%20una%20cotización%20personalizada"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      Contactar por WhatsApp
                    </a>
                  ) : (
                    <button
                      onClick={handleAddToCart}
                      className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Agregar al Carrito
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
