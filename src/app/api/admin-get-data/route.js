export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
const db = getDb();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'mariano';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return Response.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const [usersSnapshot, ordersSnapshot, productsSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('orders').get(),
      db.collection('products').get(),
    ]);

    const users = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id, ...data,
        lastLogin: data.lastLogin?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      });
    });

    const orders = [];
    let totalRevenue = 0, cvCount = 0, storeCount = 0;
    ordersSnapshot.forEach(doc => {
      const data = doc.data();
      orders.push({ id: doc.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null, updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null });
      if (data.status === 'approved' || data.status === 'completed') totalRevenue += data.totalARS || 0;
      if (data.type === 'cv_analysis') cvCount++; else storeCount++;
    });
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const products = [];
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      products.push({ id: doc.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null, updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null });
    });

    const stats = { totalUsers: users.length, totalOrders: orders.length, totalRevenue, cvAnalysis: cvCount, storeOrders: storeCount };

    await db.doc('analytics/stats').set({ registeredUsers: users.length }, { merge: true }).catch(err => console.warn(err.message));

    return Response.json({ success: true, data: { users, orders, products, stats } });
  } catch (error) {
    console.error('Error en admin-get-data:', error);
    return Response.json({ error: 'Error cargando datos', message: error.message }, { status: 500 });
  }
}
