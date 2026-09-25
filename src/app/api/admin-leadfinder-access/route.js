export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MAX_GIFT_CREDITS = 10000;

// Otorga o revoca acceso gratuito ("comped") a Lead Finder Pro para un usuario puntual —
// pensado para que Mariano pueda probar la experiencia del cliente con su propia cuenta,
// o dar cortesía a alguien sin pasar por MercadoPago. Escribe leadfinder_entitlements/{uid},
// la misma colección que va a leer el enforcement real de cuota una vez que exista.
export async function POST(request) {
  try {
    const { adminPassword, uid, grant, note, credits } = await request.json();
    if (adminPassword !== ADMIN_PASSWORD || !ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!uid) return Response.json({ error: 'uid requerido' }, { status: 400 });

    const db = getDb();
    const ref = db.collection('leadfinder_entitlements').doc(uid);

    // Regalo de una cantidad puntual de créditos: se SUMAN al saldo (mismo campo `credits`
    // que acredita el webhook de Gumroad y que descuenta /api/lead-finder-pro/run), sin
    // tocar plan ni acceso ilimitado.
    if (credits !== undefined) {
      const amount = Number(credits);
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GIFT_CREDITS) {
        return Response.json({ error: `credits debe ser un entero entre 1 y ${MAX_GIFT_CREDITS}` }, { status: 400 });
      }
      await ref.set({
        credits: admin.firestore.FieldValue.increment(amount),
        lastGiftAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      const balance = (await ref.get()).data()?.credits || 0;
      return Response.json({ success: true, gifted: amount, balance });
    }

    if (grant === false) {
      await ref.set({ plan: 'free', unlimited: false, status: 'active', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ success: true, granted: false });
    }

    await ref.set({
      plan: 'comped',
      unlimited: true,
      status: 'active',
      grantedByAdmin: true,
      note: note || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return Response.json({ success: true, granted: true });
  } catch (error) {
    return Response.json({ error: 'Error otorgando acceso', details: error.message }, { status: 500 });
  }
}

// GET — estado actual de todos los grants comped (para pintar el badge en la lista de usuarios)
export async function GET(request) {
  try {
    const adminPassword = new URL(request.url).searchParams.get('adminPassword');
    if (adminPassword !== ADMIN_PASSWORD || !ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    const db = getDb();
    const [compedSnap, creditsSnap] = await Promise.all([
      db.collection('leadfinder_entitlements').where('plan', '==', 'comped').get(),
      db.collection('leadfinder_entitlements').where('credits', '>', 0).get(),
    ]);
    const uids = compedSnap.docs.map(d => d.id);
    const balances = Object.fromEntries(creditsSnap.docs.map(d => [d.id, d.data().credits]));
    return Response.json({ uids, balances });
  } catch (error) {
    return Response.json({ error: 'Error leyendo accesos', details: error.message }, { status: 500 });
  }
}
