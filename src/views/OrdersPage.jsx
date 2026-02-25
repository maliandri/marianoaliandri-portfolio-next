'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { firebaseAuth } from '../utils/firebaseservice';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebaseservice';
import { formatARS, formatUSD } from '../utils/exchangeService';

export default function OrdersPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthChange(async (userData) => {
      setUser(userData);
      if (userData) {
        await loadOrders(userData.uid);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadOrders = async (userId) => {
    try {
      const ordersRef = collection(db, 'orders');

      // Primero buscar órdenes por userId (compras de tienda con autenticación)
      const q1 = query(
        ordersRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      // También buscar órdenes por email del usuario (compras de CV sin autenticación)
      const q2 = query(
        ordersRef,
        where('customerEmail', '==', user.email),
        orderBy('createdAt', 'desc')
      );

      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);

      const ordersData = [];
      const addedIds = new Set();

      // Agregar órdenes por userId
      snapshot1.forEach((doc) => {
        if (!addedIds.has(doc.id)) {
          ordersData.push({
            id: doc.id,
            ...doc.data()
          });
          addedIds.add(doc.id);
        }
      });

      // Agregar órdenes por email (CV analysis)
      snapshot2.forEach((doc) => {
        if (!addedIds.has(doc.id)) {
          ordersData.push({
            id: doc.id,
            ...doc.data()
          });
          addedIds.add(doc.id);
        }
      });

      // Ordenar por fecha
      ordersData.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setOrders(ordersData);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
      // Si falla la query, intentamos sin orderBy (por si no hay índice)
      try {
        const ordersRef = collection(db, 'orders');
        const q1 = query(ordersRef, where('userId', '==', userId));
        const q2 = query(ordersRef, where('customerEmail', '==', user.email));

        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(q1),
          getDocs(q2)
        ]);

        const ordersData = [];
        const addedIds = new Set();

        snapshot1.forEach((doc) => {
          if (!addedIds.has(doc.id)) {
            ordersData.push({
              id: doc.id,
              ...doc.data()
            });
            addedIds.add(doc.id);
          }
        });

        snapshot2.forEach((doc) => {
          if (!addedIds.has(doc.id)) {
            ordersData.push({
              id: doc.id,
              ...doc.data()
            });
            addedIds.add(doc.id);
          }
        });

        // Ordenar manualmente por fecha
        ordersData.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });

        setOrders(ordersData);
      } catch (fallbackError) {
        console.error('Error en fallback:', fallbackError);
      }
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', text: 'Pendiente' },
      approved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', text: 'Aprobado' },
      in_process: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', text: 'En Proceso' },
      completed: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400', text: 'Completado' },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', text: 'Cancelado' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Fecha no disponible';

    let date;
    if (timestamp.seconds) {
      // Timestamp de Firestore
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return 'Fecha no disponible';
    }

    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando compras...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Necesitás iniciar sesión
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Por favor, iniciá sesión para ver tus compras
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      {/* Botón de cierre */}
      <button
        onClick={() => router.push('/')}
        className="fixed top-6 left-6 z-50 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        title="Volver al inicio"
      >
        <svg
          className="w-6 h-6 text-gray-600 dark:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Mis Compras
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Historial de servicios contratados y su estado actual
          </p>
        </div>

        {/* Lista de órdenes */}
        {orders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No tenés compras aún
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Explorá nuestros servicios y realizá tu primera compra
            </p>
            <button
              onClick={() => router.push('/tienda')}
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              Ir a la Tienda
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <div className="mb-4 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Orden #{order.id.slice(-6).toUpperCase()}
                      </h3>
                      {getStatusBadge(order.status || 'pending')}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatARS(order.totalARS || 0)}
                    </p>
                    {order.totalUSD && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatUSD(order.totalUSD)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  {order.items && order.items.length > 0 ? (
                    <div className="space-y-3">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-gray-100">
                                {item.name}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Cantidad: {item.quantity}
                              </p>
                            </div>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {formatARS(item.priceARS * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">
                      Detalles del pedido no disponibles
                    </p>
                  )}
                </div>

                {/* Payment ID de Mercado Pago */}
                {order.paymentId && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ID de Pago: {order.paymentId}
                    </p>
                  </div>
                )}

                {/* Botón de contacto */}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => window.open(`https://wa.me/5491112345678?text=Hola! Tengo una consulta sobre mi orden ${order.id.slice(-6).toUpperCase()}`, '_blank')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    Contactar por WhatsApp
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
