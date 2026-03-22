'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { ExchangeService, formatARS, formatUSD } from '../utils/exchangeService';

const RENTAL_MONTHLY = {
  'landing-page-professional': 80,
  'website-corporate': 120,
  'website-chatbot-ia': 120,
  'ecommerce-basic': 150,
  'roi-consulting-basic': 100,
  'dashboard-powerbi-basic': 100,
};

export default function ProductCard({ product, onViewDetails, rentMode = false }) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [fx, setFx] = useState({ rate: null, loading: true });
  const fxService = new ExchangeService();

  // Cargar cotización al montar
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
  }, []);

  const handleAddToCart = () => {
    addToCart(product);
    // Mostrar feedback visual
    const button = document.getElementById(`add-to-cart-${product.id}`);
    if (button) {
      button.classList.add('animate-pulse');
      setTimeout(() => button.classList.remove('animate-pulse'), 500);
    }
  };

  const isCustom = product.priceUSD === null || product.priceUSD === undefined;
  const monthlyRate = RENTAL_MONTHLY[product.id] || null;
  const hasRental = !isCustom && monthlyRate !== null;
  const sena = hasRental ? Math.round(product.priceUSD * 0.35) : null;
  const showRental = rentMode && hasRental;

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all duration-300 flex flex-col h-full cursor-pointer"
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => router.push(`/tienda/${product.id}`)}
    >
      {/* Badge Featured */}
      {product.featured && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            ⭐ DESTACADO
          </div>
        </div>
      )}

      {/* Imagen del producto */}
      <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback si la imagen no carga
              e.target.style.display = 'none';
            }}
          />
        ) : (
          // Placeholder con icono
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-20 h-20 text-blue-600 dark:text-blue-400 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}

        {/* Demo badge si existe */}
        {product.demo && (
          <div className="absolute bottom-2 left-2">
            <a
              href={product.demo}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md text-xs font-semibold shadow-md hover:shadow-lg transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              Ver Demo →
            </a>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-5 flex flex-col flex-1">
        {/* Título y descripción */}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {product.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {product.shortDescription}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {product.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Duración */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{product.duration}</span>
          </div>
        </div>

        {/* Precio y acciones */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-3">
          {isCustom ? (
            <div className="mb-3">
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                Cotización Personalizada
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Contactanos para un presupuesto a medida
              </p>
            </div>
          ) : showRental ? (
            <div className="mb-3 space-y-0.5">
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">Seña: USD {sena}</p>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">USD {monthlyRate}/mes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Mínimo 6 meses</p>
              <span className="inline-block mt-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                Hosting incluido
              </span>
            </div>
          ) : (
            <div className="mb-3">
              {fx.loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Cargando precio...</div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {fx.rate ? formatARS(Math.ceil(product.priceUSD * fx.rate)) : formatARS(product.price || product.priceUSD * 1000)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatUSD(product.priceUSD)} • Precio oficial del día
                  </p>
                </>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2">
            <Link
              href={`/tienda/${product.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-semibold text-center"
            >
              Ver Detalles
            </Link>

            {showRental ? (
              <a
                href={`https://wa.me/5492995414422?text=${encodeURIComponent(`Hola! Me interesa alquilar ${product.name} - Seña USD ${sena} + ${monthlyRate}/mes`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all text-sm font-semibold text-center shadow-md"
              >
                Alquilar
              </a>
            ) : !isCustom && (
              <button
                id={`add-to-cart-${product.id}`}
                onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-sm font-semibold shadow-md hover:shadow-lg"
              >
                Agregar
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
