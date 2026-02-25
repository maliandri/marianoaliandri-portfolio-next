'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { ExchangeService, formatARS, formatUSD } from '../utils/exchangeService';
import { FirebaseAnalyticsService } from '../utils/firebaseservice';
import priceService from '../utils/priceService';
import SEO from '../components/SEO';
import ProductQA from '../components/ProductQA';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fx, setFx] = useState({ rate: null, loading: true });
  const fxService = new ExchangeService();
  const analyticsRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);

    async function loadProduct() {
      try {
        const allProducts = await priceService.getAllPrices();
        const found = allProducts[productId];
        if (found) {
          setProduct({
            ...found,
            shortDescription: found.shortDescription || found.description || '',
            features: found.features || ['Desarrollo profesional', 'Soporte técnico', 'Documentación incluida'],
            deliverables: found.deliverables || ['Código fuente', 'Documentación técnica', 'Capacitación'],
            tags: found.tags || [found.category || 'Servicio'],
            duration: found.duration || '2-4 semanas',
          });

          if (!analyticsRef.current) {
            analyticsRef.current = new FirebaseAnalyticsService();
          }
          analyticsRef.current.trackProductView(found.id, found.name);
        }
      } catch (error) {
        console.error('Error cargando producto:', error);
      } finally {
        setLoading(false);
      }
    }

    async function loadExchange() {
      try {
        const rate = await fxService.getExchangeRate();
        setFx({ rate, loading: false });
      } catch (error) {
        setFx({ rate: null, loading: false });
      }
    }

    loadProduct();
    loadExchange();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Producto no encontrado</h1>
          <Link href="/tienda" className="text-blue-600 hover:underline">Volver a la tienda</Link>
        </div>
      </div>
    );
  }

  const isCustom = product.priceUSD === null || product.priceUSD === undefined;

  const handleAddToCart = () => {
    addToCart(product);
    router.push('/tienda');
  };

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image ? `https://marianoaliandri.com.ar${product.image}` : 'https://marianoaliandri.com.ar/og-image.jpg',
    url: `https://marianoaliandri.com.ar/tienda/${product.id}`,
    brand: {
      '@type': 'Brand',
      name: 'Mariano Aliandri',
    },
    ...(product.priceUSD && {
      offers: {
        '@type': 'Offer',
        price: product.priceUSD,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        seller: {
          '@type': 'Person',
          name: 'Mariano Aliandri',
        },
      },
    }),
  };

  return (
    <>
      <SEO
        title={`${product.name} | Mariano Aliandri`}
        description={product.shortDescription || `${product.name} - Servicio de desarrollo profesional por Mariano Aliandri. Solución tecnológica a medida para tu negocio. Consultá precio y disponibilidad.`}
        canonical={`/tienda/${product.id}`}
        ogType="product"
        ogImage={product.image ? `https://marianoaliandri.com.ar${product.image}` : undefined}
        jsonLd={productJsonLd}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600">Inicio</Link>
            <span className="mx-2">/</span>
            <Link href="/tienda" className="hover:text-blue-600">Tienda</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 dark:text-gray-100">{product.name}</span>
          </nav>

          <motion.div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Header con imagen */}
            <div className="relative h-64 md:h-80 bg-gradient-to-br from-purple-600 to-blue-600 overflow-hidden">
              {product.image && (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover opacity-40"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                {product.featured && (
                  <span className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold mb-3">
                    DESTACADO
                  </span>
                )}
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{product.name}</h1>
                <p className="text-lg text-gray-200">{product.shortDescription}</p>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6 md:p-8">
              {/* Demo link */}
              {product.demo && (
                <div className="mb-6">
                  <a
                    href={product.demo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    Ver Demo
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}

              {/* Descripcion */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Descripcion</h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{product.description}</p>
              </div>

              {/* Caracteristicas */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Que incluye</h2>
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

              {/* Entregables y duracion */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Tiempo de entrega
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">{product.duration}</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Entregables
                  </h3>
                  <ul className="space-y-1">
                    {product.deliverables.map((item, index) => (
                      <li key={index} className="text-sm text-gray-700 dark:text-gray-300">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tags */}
              <div className="mb-8">
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

              {/* Preguntas y Respuestas */}
              <ProductQA productId={productId} productName={product.name} />

              {/* Precio y CTA */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    {isCustom ? (
                      <div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">Cotizacion Personalizada</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Contactanos para un presupuesto a medida</p>
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
                          {formatUSD(product.priceUSD)} - Precio oficial - Pago con Mercado Pago
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <Link
                      to="/tienda"
                      className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-semibold"
                    >
                      Volver a la tienda
                    </Link>

                    {isCustom ? (
                      <a
                        href={`https://wa.me/5492995414422?text=Hola!%20Me%20interesa%20${encodeURIComponent(product.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
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
        </div>
      </div>
    </>
  );
}
