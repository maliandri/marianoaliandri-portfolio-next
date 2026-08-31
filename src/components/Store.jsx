'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { productCategories } from '../data/products';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';
import Cart from './Cart';
import { useCart } from '../context/CartContext';
import priceService from '../utils/priceService';

export default function Store({ isOpen, onClose, asPage = false }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rentMode, setRentMode] = useState(false);
  const [rentalMap, setRentalMap] = useState({});
  const { getCartCount } = useCart();

  // Cargar productos desde Firebase
  useEffect(() => {
    console.log('🎯 useEffect ejecutado. isOpen:', isOpen);
    let isMounted = true;

    const loadProducts = async () => {
      console.log('📲 loadProducts() llamada');

      try {
        setLoading(true);

        // Limpiar caché para siempre obtener datos frescos
        priceService.clearCache();

        const pricesData = await priceService.getAllPrices();

        if (!isMounted) return; // No actualizar si el componente se desmontó

        console.log('🛍️ Productos cargados desde Firebase:', pricesData);

        // Convertir objeto de precios a array de productos
        const productsArray = Object.values(pricesData).map(product => ({
          id: product.id,
          name: product.name || 'Sin nombre',
          description: product.description || '',
          priceUSD: product.priceUSD || null,
          priceARS: product.priceARS || null,
          category: product.category || 'custom',
          serviceType: product.serviceType || 'store',
          websiteType: product.websiteType || null,
          active: product.active !== false,
          // Campos adicionales para compatibilidad con ProductCard y Modal
          shortDescription: product.shortDescription || product.description || '',
          features: ['Desarrollo profesional', 'Soporte técnico', 'Documentación incluida'],
          deliverables: ['Código fuente', 'Documentación técnica', 'Capacitación'],
          tags: [product.category || 'Servicio'],
          duration: '2-4 semanas',
          image: product.image || null,
          demo: product.demo || null,
          featured: product.featured || false,
          isCustom: !product.priceUSD
        }));

        setProducts(productsArray.filter(p => p.active));
      } catch (error) {
        if (!isMounted) return;
        console.error('Error cargando productos:', error);
        // Si falla, usar productos vacíos (el servicio ya tiene fallbacks)
        setProducts([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    async function loadRentalMap() {
      try {
        const res = await fetch('/api/rental-data');
        const data = await res.json();
        setRentalMap(data || {});
      } catch {
        // sin datos de alquiler
      }
    }

    if (isOpen) {
      loadProducts();
      loadRentalMap();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filtrar productos
  const filteredProducts = React.useMemo(() => {
    let filtered = products;

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    // Filtrar por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  const categories = [
    { id: 'all', label: 'Todos', icon: '🏪' },
    { id: productCategories.WEB_DEVELOPMENT, label: 'Desarrollo Web', icon: '💻' },
    { id: productCategories.CONSULTING, label: 'Consultoría', icon: '📊' },
    { id: productCategories.DATA_ANALYTICS, label: 'Data Analytics', icon: '📈' },
    { id: productCategories.CUSTOM, label: 'Personalizado', icon: '⚙️' }
  ];

  if (!isOpen) return null;

  const innerContent = (
    <>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <div>
                <h1 className="text-2xl font-bold">Tienda de Desarrollos</h1>
                <p className="text-sm text-purple-100">Soluciones tecnológicas para tu negocio</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Toggle Compra / Alquiler */}
              <div className="flex items-center gap-1 bg-white/20 rounded-lg p-1">
                <button
                  onClick={() => setRentMode(false)}
                  className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${!rentMode ? 'bg-white text-purple-700 shadow' : 'text-white'}`}
                >
                  Compra
                </button>
                <button
                  onClick={() => setRentMode(true)}
                  className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${rentMode ? 'bg-white text-purple-700 shadow' : 'text-white'}`}
                >
                  Alquiler
                </button>
              </div>
              {/* Botón del carrito */}
              <button
                onClick={() => setShowCart(true)}
                className="relative p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {getCartCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {getCartCount()}
                  </span>
                )}
              </button>
              {!asPage && (
                <button
                  onClick={onClose}
                  className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-800 dark:text-white"
              />
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-2">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de productos */}
          <div className={asPage ? 'p-6' : 'flex-1 overflow-y-auto p-6'}>
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600 mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Cargando productos...</h3>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onViewDetails={setSelectedProduct}
                    rentMode={rentMode}
                    rental={rentalMap[product.id] || null}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No se encontraron productos</h3>
                <p className="text-gray-500 dark:text-gray-400">Intenta con otros términos de búsqueda o categorías</p>
              </div>
            )}
          </div>
    </>
  );

  if (asPage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
            {innerContent}
          </div>
        </div>
        {selectedProduct && (
          <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
        )}
        {showCart && <Cart onClose={() => setShowCart(false)} />}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {innerContent}
        </motion.div>

        {/* Modal de detalle del producto */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}

        {/* Cart Sidebar */}
        {showCart && <Cart onClose={() => setShowCart(false)} />}
      </motion.div>
    </AnimatePresence>
  );
}
