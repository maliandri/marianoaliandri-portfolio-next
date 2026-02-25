// netlify/functions/admin-get-data.js
import admin from 'firebase-admin';

// Inicializar Firebase Admin (solo una vez)
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

// Credenciales de admin (deberías usar variables de entorno)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'mariano';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
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
    // Verificar autenticación
    const { username, password } = JSON.parse(event.body);

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Credenciales inválidas' })
      };
    }

    console.log('✅ Admin autenticado, cargando datos...');

    // Cargar todos los datos en paralelo
    const [usersSnapshot, ordersSnapshot, productsSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('orders').get(),
      db.collection('products').get()
    ]);

    // Procesar usuarios
    const users = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        ...data,
        // Convertir timestamps a strings para JSON
        lastLogin: data.lastLogin?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      });
    });

    // Procesar órdenes
    const orders = [];
    let totalRevenue = 0;
    let cvCount = 0;
    let storeCount = 0;

    ordersSnapshot.forEach((doc) => {
      const data = doc.data();
      const order = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      };
      orders.push(order);

      // Calcular estadísticas
      if (data.status === 'approved' || data.status === 'completed') {
        totalRevenue += data.totalARS || 0;
      }

      if (data.type === 'cv_analysis') {
        cvCount++;
      } else {
        storeCount++;
      }
    });

    // Ordenar órdenes por fecha (más recientes primero)
    orders.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    // Procesar productos
    const products = [];
    productsSnapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      });
    });

    // Calcular estadísticas
    const stats = {
      totalUsers: users.length,
      totalOrders: orders.length,
      totalRevenue,
      cvAnalysis: cvCount,
      storeOrders: storeCount
    };

    // Sincronizar contador de usuarios registrados en analytics/stats
    await db.doc('analytics/stats').set(
      { registeredUsers: users.length },
      { merge: true }
    ).catch(err => console.warn('⚠️ No se pudo sincronizar registeredUsers:', err.message));

    console.log('✅ Datos cargados:', {
      users: users.length,
      orders: orders.length,
      products: products.length,
      revenue: totalRevenue
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          users,
          orders,
          products,
          stats
        }
      })
    };
  } catch (error) {
    console.error('❌ Error en admin-get-data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error cargando datos',
        message: error.message
      })
    };
  }
};
