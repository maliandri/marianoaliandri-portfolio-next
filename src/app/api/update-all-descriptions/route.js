import admin, { db } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Maliandri$#652542026';
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dlshym1te/image/upload/c_fill,w_400,h_300,f_auto,q_auto/v1765836744';

const PRODUCT_DESCRIPTIONS = {
  'roi-consulting': { name: 'Consulta Personalizada ROI', description: 'Análisis detallado de retorno de inversión para tu negocio. Evaluamos tus procesos actuales, identificamos oportunidades de optimización y calculamos el impacto financiero de implementar soluciones tecnológicas. Incluye reporte completo con métricas clave, recomendaciones estratégicas y proyección de ahorros.', shortDescription: 'Análisis de ROI personalizado con reporte detallado de oportunidades', image: `${CLOUDINARY_BASE}/ROICONSULT.webp` },
  'landing-page': { name: 'Landing Page', description: 'Página de aterrizaje profesional diseñada para maximizar conversiones. Ideal para lanzamientos de productos, campañas de marketing o captación de leads. Incluye diseño responsivo, formulario de contacto optimizado, integración con Google Analytics, optimización SEO básica y velocidad de carga ultrarrápida.', shortDescription: 'Página única optimizada para conversión de visitantes en clientes', image: `${CLOUDINARY_BASE}/LANDINGPAGE.webp` },
  'business-website': { name: 'Sitio Web Empresarial', description: 'Sitio web corporativo completo con 4-8 páginas profesionales. Perfecto para empresas que buscan presencia digital sólida. Incluye diseño personalizado, secciones institucionales, formularios de contacto, galería de proyectos, blog integrado y panel de administración.', shortDescription: 'Sitio corporativo profesional con múltiples secciones y panel admin', image: `${CLOUDINARY_BASE}/SITIOCORPORATIVO.webp` },
  'ecommerce': { name: 'E-commerce', description: 'Tienda online completa con carrito de compras, pasarela de pagos y gestión de inventario. Incluye catálogo de productos ilimitado, sistema de pagos con Mercado Pago/PayPal, panel de administración de órdenes, gestión de stock, cupones de descuento y reportes de ventas.', shortDescription: 'Tienda online completa con pagos, inventario y gestión de órdenes', image: `${CLOUDINARY_BASE}/ecommerce.webp` },
  'portfolio': { name: 'Portfolio/Catálogo', description: 'Sitio web tipo portfolio para mostrar tus proyectos, trabajos o productos de forma profesional. Incluye galería de proyectos con lightbox, categorización, filtros interactivos, página de casos de éxito, sección de testimonios y formulario de cotización.', shortDescription: 'Galería profesional de proyectos con filtros y casos de éxito', image: `${CLOUDINARY_BASE}/portfolio.webp` },
  'blog': { name: 'Blog/Noticias', description: 'Plataforma de contenidos con sistema de blog profesional. Incluye editor de artículos WYSIWYG, categorías y etiquetas, buscador interno, comentarios moderados, suscripción por email, RSS feed, compartir en redes sociales y optimización SEO automática.', shortDescription: 'Plataforma de contenidos con editor, categorías y SEO optimizado', image: `${CLOUDINARY_BASE}/BlogNoticias.webp` },
  'webapp': { name: 'Aplicación Web', description: 'Aplicación web personalizada a medida para procesos de negocio específicos. Desarrollo de sistemas complejos con múltiples funcionalidades: gestión de usuarios con roles, bases de datos relacionales, API REST, dashboard con métricas en tiempo real, notificaciones push y arquitectura escalable.', shortDescription: 'Sistema web personalizado con gestión de usuarios, API y dashboards', image: `${CLOUDINARY_BASE}/webapp.webp` },
  'membership': { name: 'Sitio de Membresías', description: 'Plataforma con sistema de membresías y contenido exclusivo. Ideal para cursos online, comunidades premium o suscripciones. Incluye registro y login de usuarios, niveles de membresía, área privada de miembros, gestión de suscripciones recurrentes con Mercado Pago y panel de usuario personalizado.', shortDescription: 'Plataforma de membresías con área privada y suscripciones recurrentes', image: `${CLOUDINARY_BASE}/Membresias.webp` },
  'ai-chatbot-website': { name: 'Página Web con Atención IA', description: 'Sitio web empresarial potenciado con chatbot de inteligencia artificial. El asistente virtual responde preguntas frecuentes 24/7, califica leads automáticamente y deriva consultas complejas. Incluye sitio web de 3-5 páginas, chatbot entrenado con tu información e integración con WhatsApp/Email.', shortDescription: 'Web con chatbot IA que atiende clientes 24/7 y califica leads', image: `${CLOUDINARY_BASE}/WEBATENCIONIA.webp` },
  'powerbi-dashboard': { name: 'Dashboard Power BI', description: 'Dashboard interactivo personalizado con Power BI para visualización de datos empresariales. Conecta múltiples fuentes de datos (Excel, SQL, APIs, Google Sheets), transforma información en gráficos ejecutivos, métricas KPI en tiempo real y actualización automática programada.', shortDescription: 'Dashboard ejecutivo con visualización de datos y métricas en tiempo real', image: `${CLOUDINARY_BASE}/dashboard.webp` },
};

export async function POST(request) {
  try {
    const { adminPassword } = await request.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const updatedProducts = [];
    await Promise.all(
      Object.entries(PRODUCT_DESCRIPTIONS).map(async ([productId, productData]) => {
        await db.collection('products').doc(productId).update({
          name: productData.name,
          description: productData.description,
          shortDescription: productData.shortDescription || productData.description,
          image: productData.image || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updatedProducts.push(productId);
      })
    );

    return Response.json({ success: true, message: `${updatedProducts.length} productos actualizados exitosamente`, products: updatedProducts });
  } catch (error) {
    return Response.json({ error: 'Error actualizando productos', message: error.message }, { status: 500 });
  }
}
