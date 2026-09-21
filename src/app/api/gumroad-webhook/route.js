export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';

// Webhook de Gumroad ("Ping") para los packs de créditos de Lead Finder Pro que se
// venden en USD (complemento a MercadoPago/ARS, ver /api/payment-webhook). Configurar
// en Gumroad → Settings → Advanced → Ping:
//   https://marianoaliandri.com.ar/api/gumroad-webhook/   (¡con barra final!)
//
// Gumroad NO firma el Ping (a diferencia de MercadoPago), así que cualquiera podría
// simular un POST a esta URL. Por eso el webhook nunca confía en el body del Ping
// para acreditar créditos — solo lo usa para saber que "algo pasó" y disparar una
// re-consulta a la API de Gumroad (GET /v2/sales/:id con GUMROAD_ACCESS_TOKEN), que sí
// es una fuente confiable porque requiere nuestro propio access token.
//
// Mapeo precio → créditos: por precio en centavos USD en vez de por nombre de variante
// ("Starter 50" / "Starter 100"), porque el nombre de la variante es texto libre editable
// en Gumroad y no queremos depender de que nadie lo tipee exactamente igual. Si cambian
// los precios en Gumroad, hay que actualizar este mapa en el mismo cambio.
const PRICE_CENTS_TO_CREDITS = {
  900: 50,    // Starter 50  — $9
  1500: 100,  // Starter 100 — $15
};

async function verifySale(saleId) {
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) throw new Error('GUMROAD_ACCESS_TOKEN no configurado');
  const url = `https://api.gumroad.com/v2/sales/${encodeURIComponent(saleId)}?access_token=${encodeURIComponent(token)}`;
  const resp = await fetch(url);
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data?.success || !data?.sale) return null;
  return data.sale;
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fields;
    if (contentType.includes('application/json')) {
      fields = await request.json().catch(() => ({}));
    } else {
      const form = await request.formData();
      fields = Object.fromEntries(form.entries());
    }

    const saleId = fields.sale_id;
    if (!saleId) {
      // Gumroad manda pings de "resource_name": "sale" con sale_id. Cualquier otro
      // evento (o un POST malformado) se ignora sin romper — Gumroad reintenta si
      // devolvemos error, y no queremos reintentos infinitos por algo que no es una venta.
      return Response.json({ received: true, ignored: true });
    }

    // Ping de prueba (botón "Send test ping" en Gumroad) — datos ficticios, no acreditar.
    if (fields.test === 'true' || fields.test === true) {
      console.log('[gumroad-webhook] test ping recibido, no se acredita nada');
      return Response.json({ received: true, test: true });
    }

    let sale;
    try {
      sale = await verifySale(saleId);
    } catch (e) {
      console.error('[gumroad-webhook] error verificando venta contra la API de Gumroad:', e.message);
      return Response.json({ error: 'No se pudo verificar la venta' }, { status: 500 });
    }
    if (!sale) {
      console.warn('[gumroad-webhook] venta no verificada por la API de Gumroad, se ignora:', saleId);
      return Response.json({ error: 'Venta no verificada' }, { status: 401 });
    }
    if (sale.refunded || sale.chargebacked || sale.disputed) {
      console.warn('[gumroad-webhook] venta reembolsada/disputada, no se acredita:', saleId);
      return Response.json({ received: true, ignored: true });
    }

    const priceCents = Number(sale.price);
    const credits = PRICE_CENTS_TO_CREDITS[priceCents] || 0;
    if (!credits) {
      console.warn('[gumroad-webhook] precio sin mapeo a créditos, revisar PRICE_CENTS_TO_CREDITS:', priceCents, saleId);
      return Response.json({ received: true, ignored: true });
    }

    const buyerEmail = sale.email;
    if (!buyerEmail) {
      console.error('[gumroad-webhook] venta sin email, no se puede acreditar:', saleId);
      return Response.json({ error: 'Venta sin email' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    // Busca el usuario Firebase por email, o lo crea si es la primera vez que compra
    // — el comprador después inicia sesión con Google usando este mismo email y ya
    // tiene los créditos esperándolo en leadfinder_entitlements.
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(buyerEmail);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({ email: buyerEmail });
      } else {
        throw e;
      }
    }
    const uid = userRecord.uid;

    // Idempotente: usa el sale_id de Gumroad como llave de deduplicación, mismo patrón
    // que creditLeadFinderPlan() en /api/payment-webhook con el paymentId de MercadoPago
    // — Gumroad puede reintentar el Ping y no queremos sumar créditos dos veces.
    const dedupeRef = db.collection('leadfinder_processed_gumroad_sales').doc(String(saleId));
    const alreadyProcessed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(dedupeRef);
      if (snap.exists) return true;
      tx.set(dedupeRef, {
        uid, email: buyerEmail, credits, priceCents,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('leadfinder_entitlements').doc(uid), {
        credits: admin.firestore.FieldValue.increment(credits),
        billingType: 'project',
        planId: `gumroad-${credits}`,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return false;
    });

    if (alreadyProcessed) {
      console.warn('[gumroad-webhook] venta ya procesada, se ignora:', saleId);
    } else {
      console.log('[gumroad-webhook] créditos acreditados:', { uid, buyerEmail, credits, saleId });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[gumroad-webhook] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Gumroad a veces valida la URL con un GET antes de guardar la config del Ping.
export async function GET() {
  return Response.json({ ok: true });
}
