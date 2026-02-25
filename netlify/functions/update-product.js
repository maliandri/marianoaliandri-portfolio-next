// netlify/functions/update-product.js
// Actualizar producto usando Firebase Admin SDK (bypasea security rules)
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
    const { adminPassword, productId, updates } = JSON.parse(event.body);

    // Verificar contraseña de admin
    if (adminPassword !== ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No autorizado' })
      };
    }

    console.log(`📝 Actualizando producto ${productId}...`);

    // Actualizar producto usando Admin SDK (bypasea las security rules)
    await db.collection('products').doc(productId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Producto ${productId} actualizado exitosamente`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Producto actualizado exitosamente',
        productId
      })
    };
  } catch (error) {
    console.error('❌ Error actualizando producto:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error actualizando producto',
        message: error.message
      })
    };
  }
};
