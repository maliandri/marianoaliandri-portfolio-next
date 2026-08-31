// src/utils/priceService.js
// Servicio centralizado para obtener precios desde Firebase
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseservice';

class PriceService {
  constructor() {
    this.pricesCache = null;
    this.cacheTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Obtener precio de un producto por ID
   * @param {string} productId - ID del producto (ej: 'landing-page', 'roi-consulting')
   * @returns {Promise<{priceUSD: number, priceARS: number|null}>}
   */
  async getPrice(productId) {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));

      if (productDoc.exists()) {
        const data = productDoc.data();
        return {
          priceUSD: data.priceUSD || 0,
          priceARS: data.priceARS || null
        };
      }

      console.warn(`Producto ${productId} no encontrado en Firebase`);
      return this.getFallbackPrice(productId);
    } catch (error) {
      console.error(`Error obteniendo precio de ${productId}:`, error);
      return this.getFallbackPrice(productId);
    }
  }

  /**
   * Obtener todos los precios de una vez (con caché)
   * @returns {Promise<Object>} Objeto con todos los productos
   */
  async getAllPrices() {
    // Usar caché si está disponible y no ha expirado
    const now = Date.now();
    if (this.pricesCache && this.cacheTime && (now - this.cacheTime) < this.CACHE_DURATION) {
      console.log('📦 Usando caché de precios');
      return this.pricesCache;
    }

    try {
      console.log('🔥 Intentando cargar precios desde Firebase...');
      console.log('🔧 Firebase db object:', db ? 'initialized' : 'undefined');
      console.log('🔧 Firebase project:', db?.app?.options?.projectId || 'unknown');
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const prices = {};

      productsSnapshot.forEach(doc => {
        prices[doc.id] = {
          id: doc.id,
          ...doc.data()
        };
      });

      console.log(`✅ Cargados ${Object.keys(prices).length} productos desde Firebase`);

      // Actualizar caché
      this.pricesCache = prices;
      this.cacheTime = now;

      return prices;
    } catch (error) {
      console.error('❌ Error cargando desde Firebase, usando fallbacks:', error);
      return this.getAllFallbackPrices();
    }
  }

  /**
   * Obtener precio de un tipo de sitio web para la calculadora
   * @param {string} websiteType - Tipo de sitio (landing, business, ecommerce, etc.)
   * @returns {Promise<number>} Precio base en USD
   */
  async getWebsiteTypePrice(websiteType) {
    const productId = this.getProductIdFromWebsiteType(websiteType);
    const price = await this.getPrice(productId);
    return price.priceUSD;
  }

  /**
   * Mapear tipo de sitio web a ID de producto
   */
  getProductIdFromWebsiteType(websiteType) {
    const mapping = {
      'landing': 'landing-page',
      'business': 'business-website',
      'ecommerce': 'ecommerce',
      'portfolio': 'portfolio',
      'blog': 'blog',
      'webapp': 'webapp',
      'membership': 'membership'
    };

    return mapping[websiteType] || 'landing-page';
  }

  /**
   * Precios de fallback (por si Firebase falla)
   */
  getFallbackPrice(productId) {
    const fallbackPrices = {
      'roi-consulting': { priceUSD: 100, priceARS: null },
      'landing-page': { priceUSD: 400, priceARS: null },
      'business-website': { priceUSD: 1000, priceARS: null },
      'ecommerce': { priceUSD: 2000, priceARS: null },
      'portfolio': { priceUSD: 1200, priceARS: null },
      'blog': { priceUSD: 1500, priceARS: null },
      'webapp': { priceUSD: 6000, priceARS: null },
      'membership': { priceUSD: 2500, priceARS: null },
      'ai-chatbot-website': { priceUSD: 800, priceARS: null },
      'powerbi-dashboard': { priceUSD: 1200, priceARS: null }
    };

    return fallbackPrices[productId] || { priceUSD: 0, priceARS: null };
  }

  getAllFallbackPrices() {
    return {
      'roi-consulting': {
        id: 'roi-consulting',
        name: 'Consulta Personalizada ROI',
        shortDescription: 'Analizá el retorno de inversión de tu proyecto digital con una consulta personalizada. Identificá oportunidades y optimizá tu presupuesto tecnológico.',
        priceUSD: 100,
        category: 'consulting',
        serviceType: 'roi-calculator'
      },
      'landing-page': {
        id: 'landing-page',
        name: 'Landing Page',
        shortDescription: 'Landing page profesional y optimizada para conversión. Diseño moderno, carga rápida y orientada a captar leads y ventas para tu negocio.',
        priceUSD: 400,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'landing'
      },
      'business-website': {
        id: 'business-website',
        name: 'Sitio Web Empresarial',
        shortDescription: 'Sitio web empresarial completo con diseño profesional, SEO optimizado y panel de administración. La presencia digital que tu empresa necesita.',
        priceUSD: 1000,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'business'
      },
      'ecommerce': {
        id: 'ecommerce',
        name: 'E-commerce',
        shortDescription: 'Tienda online completa con carrito de compras, pasarela de pago y gestión de productos. Vendé tus productos o servicios en internet las 24 horas.',
        priceUSD: 2000,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'ecommerce'
      },
      'portfolio': {
        id: 'portfolio',
        name: 'Portfolio/Catálogo',
        shortDescription: 'Portfolio o catálogo digital para mostrar tus trabajos, productos o servicios de forma visual y profesional. Ideal para creativos y empresas.',
        priceUSD: 1200,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'portfolio'
      },
      'blog': {
        id: 'blog',
        name: 'Blog/Noticias',
        shortDescription: 'Blog o sitio de noticias con sistema de gestión de contenidos, categorías, buscador y optimización SEO para posicionar tu marca como referente.',
        priceUSD: 1500,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'blog'
      },
      'webapp': {
        id: 'webapp',
        name: 'Aplicación Web',
        shortDescription: 'Aplicación web a medida con React y backend robusto. Sistemas de gestión, dashboards, automatizaciones y soluciones digitales para tu empresa.',
        priceUSD: 6000,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'webapp'
      },
      'membership': {
        id: 'membership',
        name: 'Sitio de Membresías',
        shortDescription: 'Plataforma de membresías con registro de usuarios, contenido exclusivo, pagos recurrentes y panel de gestión. Monetizá tu conocimiento online.',
        priceUSD: 2500,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'membership'
      },
      'ai-chatbot-website': {
        id: 'ai-chatbot-website',
        name: 'Página Web con Atención IA',
        shortDescription: 'Sitio web con chatbot de inteligencia artificial integrado para atención al cliente 24/7. Respondé consultas automáticamente y mejorá la experiencia del usuario.',
        priceUSD: 800,
        category: 'web-development',
        serviceType: 'store'
      },
      'powerbi-dashboard': {
        id: 'powerbi-dashboard',
        name: 'Dashboard Power BI',
        shortDescription: 'Dashboard interactivo en Power BI con visualización de datos en tiempo real. Tomá decisiones basadas en datos con reportes profesionales y actualizados.',
        priceUSD: 1200,
        category: 'data-analytics',
        serviceType: 'store'
      }
    };
  }

  /**
   * Limpiar caché (útil después de actualizar precios en el admin)
   */
  clearCache() {
    this.pricesCache = null;
    this.cacheTime = null;
  }
}

// Exportar instancia singleton
export const priceService = new PriceService();
export default priceService;
