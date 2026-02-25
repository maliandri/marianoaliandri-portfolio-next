// netlify/functions/update-all-descriptions.js
// Actualizar descripciones de TODOS los productos con información detallada

import admin from 'firebase-admin';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Maliandri$#652542026';

// 📋 Descripciones profesionales con beneficios e imágenes
// Cloudinary URLs con el Cloud Name correcto y optimizaciones
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dlshym1te/image/upload/c_fill,w_400,h_300,f_auto,q_auto/v1765836744';

const PRODUCT_DESCRIPTIONS = {
  'roi-consulting': {
    name: 'Consulta Personalizada ROI',
    description: 'Análisis detallado de retorno de inversión para tu negocio. Evaluamos tus procesos actuales, identificamos oportunidades de optimización y calculamos el impacto financiero de implementar soluciones tecnológicas. Incluye reporte completo con métricas clave, recomendaciones estratégicas y proyección de ahorros.',
    shortDescription: 'Análisis de ROI personalizado con reporte detallado de oportunidades',
    image: `${CLOUDINARY_BASE}/ROICONSULT.webp`
  },
  'landing-page': {
    name: 'Landing Page',
    description: 'Página de aterrizaje profesional diseñada para maximizar conversiones. Ideal para lanzamientos de productos, campañas de marketing o captación de leads. Incluye diseño responsivo, formulario de contacto optimizado, integración con Google Analytics, optimización SEO básica y velocidad de carga ultrarrápida.',
    shortDescription: 'Página única optimizada para conversión de visitantes en clientes',
    image: `${CLOUDINARY_BASE}/LANDINGPAGE.webp`
  },
  'business-website': {
    name: 'Sitio Web Empresarial',
    description: 'Sitio web corporativo completo con 4-8 páginas profesionales. Perfecto para empresas que buscan presencia digital sólida. Incluye diseño personalizado, secciones institucionales (nosotros, servicios, contacto), formularios de contacto, galería de proyectos, blog integrado y panel de administración para actualizar contenidos sin conocimientos técnicos.',
    shortDescription: 'Sitio corporativo profesional con múltiples secciones y panel admin',
    image: `${CLOUDINARY_BASE}/SITIOCORPORATIVO.webp`
  },
  'ecommerce': {
    name: 'E-commerce',
    description: 'Tienda online completa con carrito de compras, pasarela de pagos y gestión de inventario. Incluye catálogo de productos ilimitado, búsqueda avanzada, filtros por categoría, sistema de pagos con Mercado Pago/PayPal, panel de administración de órdenes, gestión de stock, cupones de descuento, email transaccional automático y reportes de ventas.',
    shortDescription: 'Tienda online completa con pagos, inventario y gestión de órdenes',
    image: `${CLOUDINARY_BASE}/ecommerce.webp`
  },
  'portfolio': {
    name: 'Portfolio/Catálogo',
    description: 'Sitio web tipo portfolio para mostrar tus proyectos, trabajos o productos de forma profesional. Ideal para diseñadores, fotógrafos, arquitectos o empresas de servicios. Incluye galería de proyectos con lightbox, categorización, filtros interactivos, página de casos de éxito, sección de testimonios y formulario de cotización.',
    shortDescription: 'Galería profesional de proyectos con filtros y casos de éxito',
    image: `${CLOUDINARY_BASE}/portfolio.webp`
  },
  'blog': {
    name: 'Blog/Noticias',
    description: 'Plataforma de contenidos con sistema de blog profesional. Perfecta para marketing de contenidos, noticias corporativas o publicaciones regulares. Incluye editor de artículos WYSIWYG, categorías y etiquetas, buscador interno, comentarios moderados, suscripción por email, RSS feed, compartir en redes sociales y optimización SEO automática.',
    shortDescription: 'Plataforma de contenidos con editor, categorías y SEO optimizado',
    image: `${CLOUDINARY_BASE}/BlogNoticias.webp`
  },
  'webapp': {
    name: 'Aplicación Web',
    description: 'Aplicación web personalizada a medida para procesos de negocio específicos. Desarrollo de sistemas complejos con múltiples funcionalidades: gestión de usuarios con roles, bases de datos relacionales, API REST, dashboard con métricas en tiempo real, notificaciones push, exportación de datos (Excel/PDF), integración con servicios externos y arquitectura escalable.',
    shortDescription: 'Sistema web personalizado con gestión de usuarios, API y dashboards',
    image: `${CLOUDINARY_BASE}/webapp.webp`
  },
  'membership': {
    name: 'Sitio de Membresías',
    description: 'Plataforma con sistema de membresías y contenido exclusivo. Ideal para cursos online, comunidades premium o suscripciones. Incluye registro y login de usuarios, niveles de membresía (básico/premium), área privada de miembros, gestión de suscripciones recurrentes con Mercado Pago, control de acceso por rol, foro privado y panel de usuario personalizado.',
    shortDescription: 'Plataforma de membresías con área privada y suscripciones recurrentes',
    image: `${CLOUDINARY_BASE}/Membresias.webp`
  },
  'ai-chatbot-website': {
    name: 'Página Web con Atención IA',
    description: 'Sitio web empresarial potenciado con chatbot de inteligencia artificial. El asistente virtual responde preguntas frecuentes 24/7, califica leads automáticamente y deriva consultas complejas. Incluye sitio web de 3-5 páginas, chatbot entrenado con tu información, integración con WhatsApp/Email, panel de analíticas de conversaciones y captación de leads cualificados.',
    shortDescription: 'Web con chatbot IA que atiende clientes 24/7 y califica leads',
    image: `${CLOUDINARY_BASE}/WEBATENCIONIA.webp`
  },
  'powerbi-dashboard': {
    name: 'Dashboard Power BI',
    description: 'Dashboard interactivo personalizado con Power BI para visualización de datos empresariales. Conecta múltiples fuentes de datos (Excel, SQL, APIs, Google Sheets), transforma información en gráficos ejecutivos, métricas KPI en tiempo real, filtros interactivos, drill-down por dimensiones, actualización automática programada y acceso desde cualquier dispositivo.',
    shortDescription: 'Dashboard ejecutivo con visualización de datos y métricas en tiempo real',
    image: `${CLOUDINARY_BASE}/dashboard.webp`
  }
};

export const handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Manejar preflight request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { adminPassword } = JSON.parse(event.body);

    // Verificar contraseña de admin
    if (adminPassword !== ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No autorizado' })
      };
    }

    const updatePromises = [];
    const updatedProducts = [];

    // Actualizar cada producto
    for (const [productId, productData] of Object.entries(PRODUCT_DESCRIPTIONS)) {
      const promise = db.collection('products').doc(productId).update({
        name: productData.name,
        description: productData.description,
        shortDescription: productData.shortDescription || productData.description,
        image: productData.image || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        updatedProducts.push(productId);
        console.log(`✅ Actualizado: ${productId}`);
      });

      updatePromises.push(promise);
    }

    // Esperar a que todas las actualizaciones terminen
    await Promise.all(updatePromises);

    console.log(`✅ ${updatedProducts.length} productos actualizados con descripciones`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${updatedProducts.length} productos actualizados exitosamente`,
        products: updatedProducts
      })
    };

  } catch (error) {
    console.error('❌ Error actualizando descripciones:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error actualizando productos',
        message: error.message
      })
    };
  }
};
