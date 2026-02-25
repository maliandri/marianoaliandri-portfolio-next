import admin, { db } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Maliandri$#652542026';

const products = [
  { id: 'roi-consulting', name: 'Consulta Personalizada ROI', description: 'Análisis de retorno de inversión personalizado', priceUSD: 100, category: 'consulting', serviceType: 'roi-calculator', active: true },
  { id: 'landing-page', name: 'Landing Page', description: 'Página de aterrizaje profesional', priceUSD: 400, category: 'web-development', serviceType: 'web-calculator', websiteType: 'landing', active: true },
  { id: 'business-website', name: 'Sitio Web Empresarial', description: 'Sitio web completo para empresas', priceUSD: 1000, category: 'web-development', serviceType: 'web-calculator', websiteType: 'business', active: true },
  { id: 'ecommerce', name: 'E-commerce', description: 'Tienda online completa', priceUSD: 2000, category: 'web-development', serviceType: 'web-calculator', websiteType: 'ecommerce', active: true },
  { id: 'portfolio', name: 'Portfolio/Catálogo', description: 'Sitio web tipo portfolio', priceUSD: 1200, category: 'web-development', serviceType: 'web-calculator', websiteType: 'portfolio', active: true },
  { id: 'blog', name: 'Blog/Noticias', description: 'Sitio web con blog integrado', priceUSD: 1500, category: 'web-development', serviceType: 'web-calculator', websiteType: 'blog', active: true },
  { id: 'webapp', name: 'Aplicación Web', description: 'Aplicación web personalizada', priceUSD: 6000, category: 'web-development', serviceType: 'web-calculator', websiteType: 'webapp', active: true },
  { id: 'membership', name: 'Sitio de Membresías', description: 'Plataforma con sistema de membresías', priceUSD: 2500, category: 'web-development', serviceType: 'web-calculator', websiteType: 'membership', active: true },
  { id: 'ai-chatbot-website', name: 'Página Web con Atención IA', description: 'Sitio web con chatbot inteligente integrado', priceUSD: 800, category: 'web-development', serviceType: 'store', active: true },
  { id: 'powerbi-dashboard', name: 'Dashboard Power BI', description: 'Dashboard interactivo personalizado', priceUSD: 1200, category: 'data-analytics', serviceType: 'store', active: true },
];

export async function POST(request) {
  try {
    const { adminPassword } = await request.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const productsSnapshot = await db.collection('products').get();
    await Promise.all(productsSnapshot.docs.map(doc => doc.ref.delete()));

    await Promise.all(products.map(({ id, ...productData }) =>
      db.collection('products').doc(id).set({ ...productData, createdAt: admin.firestore.FieldValue.serverTimestamp() })
    ));

    return Response.json({ success: true, message: 'Productos resetados exitosamente', productsCreated: products.length, productIds: products.map(p => p.id) });
  } catch (error) {
    return Response.json({ error: 'Error reseteando productos', message: error.message }, { status: 500 });
  }
}
