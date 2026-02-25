'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { ExchangeService, formatARS, formatUSD } from '../utils/exchangeService';
import { createPaymentPreference } from '../utils/mercadoPagoConfig';
import { firebaseAuth } from '../utils/firebaseservice';

export default function Cart({ onClose }) {
  const { cart, removeFromCart, updateQuantity, clearCart, getCartCount } = useCart();
  const [loading, setLoading] = useState(false);
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

  // Calcular precio en ARS usando cotización
  const getPriceARS = (product) => {
    if (!fx.rate) return product.price || product.priceUSD * 1000;
    return Math.ceil(product.priceUSD * fx.rate);
  };

  // Calcular total del carrito
  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const priceARS = getPriceARS(item);
      return total + priceARS * item.quantity;
    }, 0);
  };

  const handleCheckout = async () => {
    // Verificar autenticación
    const currentUser = firebaseAuth.getCurrentUser();
    if (!currentUser) {
      alert('Necesitás iniciar sesión para comprar');
      return;
    }

    if (cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    setLoading(true);

    try {
      // Crear items para Mercado Pago con precio en ARS
      const items = cart.map(item => ({
        title: item.name,
        description: item.shortDescription,
        unit_price: getPriceARS(item),
        quantity: item.quantity,
        currency_id: 'ARS'
      }));

      // Crear preferencia de pago
      const preference = await createPaymentPreference({
        items,
        payer: {
          email: currentUser.email,
          name: currentUser.displayName
        },
        metadata: {
          user_id: currentUser.uid,
          user_email: currentUser.email,
          cart_items: JSON.stringify(cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })))
        }
      });

      // Redirigir a Mercado Pago
      if (preference.init_point) {
        window.location.href = preference.init_point;
      } else {
        throw new Error('No se obtuvo la URL de pago');
      }
    } catch (error) {
      console.error('Error al crear el pago:', error);
      alert('Hubo un error al procesar el pago. Por favor, intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-end z-[70]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-gray-800 w-full sm:w-96 h-full sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-xl font-bold">Carrito ({getCartCount()})</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <svg className="w-24 h-24 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Tu carrito está vacío
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Explorá la tienda y agregá productos
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex gap-3">
                      {/* Icono del producto */}
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>

                      {/* Info del producto */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                          {item.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {formatARS(getPriceARS(item))}
                        </p>

                        {/* Controles de cantidad */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>

                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-8 text-center">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>

                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-auto p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            title="Eliminar"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Subtotal del item */}
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Subtotal:</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatARS(getPriceARS(item) * item.quantity)}
                      </span>
                    </div>
                  </motion.div>
                ))}

                {/* Botón para vaciar carrito */}
                {cart.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('¿Estás seguro de vaciar el carrito?')) {
                        clearCart();
                      }
                    }}
                    className="w-full text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Vaciar carrito
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer con total y checkout */}
          {cart.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Total:</span>
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatARS(getCartTotal())}
                </span>
              </div>

              {/* Botón de checkout */}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Pagar con Mercado Pago
                  </>
                )}
              </button>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Pago seguro • Procesado por Mercado Pago
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
