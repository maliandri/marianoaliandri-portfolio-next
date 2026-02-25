// netlify/functions/reset-products.js
// Limpia y recrea todos los productos
import admin from 'firebase-admin';

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

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { adminPassword } = JSON.parse(event.body);

    if (adminPassword !== ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No autorizado' })
      };
    }

    console.log('🗑️ Eliminando productos existentes...');

    // Eliminar todos los productos existentes
    const productsSnapshot = await db.collection('products').get();
    const deletePromises = [];
    productsSnapshot.forEach(doc => {
      deletePromises.push(doc.ref.delete());
    });
    await Promise.all(deletePromises);

    console.log(`✅ ${productsSnapshot.size} productos eliminados`);

    // Crear productos nuevos
    const products = [
      {
        id: 'roi-consulting',
        name: 'Consulta Personalizada ROI',
        description: 'Análisis de retorno de inversión personalizado',
        priceUSD: 100,
        category: 'consulting',
        serviceType: 'roi-calculator',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'landing-page',
        name: 'Landing Page',
        description: 'Página de aterrizaje profesional',
        priceUSD: 400,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'landing',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'business-website',
        name: 'Sitio Web Empresarial',
        description: 'Sitio web completo para empresas',
        priceUSD: 1000,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'business',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'ecommerce',
        name: 'E-commerce',
        description: 'Tienda online completa',
        priceUSD: 2000,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'ecommerce',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'portfolio',
        name: 'Portfolio/Catálogo',
        description: 'Sitio web tipo portfolio',
        priceUSD: 1200,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'portfolio',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'blog',
        name: 'Blog/Noticias',
        description: 'Sitio web con blog integrado',
        priceUSD: 1500,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'blog',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'webapp',
        name: 'Aplicación Web',
        description: 'Aplicación web personalizada',
        priceUSD: 6000,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'webapp',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'membership',
        name: 'Sitio de Membresías',
        description: 'Plataforma con sistema de membresías',
        priceUSD: 2500,
        category: 'web-development',
        serviceType: 'web-calculator',
        websiteType: 'membership',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'ai-chatbot-website',
        name: 'Página Web con Atención IA',
        description: 'Sitio web con chatbot inteligente integrado',
        priceUSD: 800,
        category: 'web-development',
        serviceType: 'store',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        id: 'powerbi-dashboard',
        name: 'Dashboard Power BI',
        description: 'Dashboard interactivo personalizado',
        priceUSD: 1200,
        category: 'data-analytics',
        serviceType: 'store',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    console.log(`🔄 Creando ${products.length} productos...`);

    const createPromises = [];
    for (const product of products) {
      const { id, ...productData } = product;
      createPromises.push(
        db.collection('products').doc(id).set(productData)
      );
    }

    await Promise.all(createPromises);

    console.log(`✅ ${products.length} productos creados exitosamente`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Productos resetados exitosamente`,
        productsCreated: products.length,
        productIds: products.map(p => p.id)
      })
    };
  } catch (error) {
    console.error('❌ Error reseteando productos:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error reseteando productos',
        message: error.message
      })
    };
  }
};
