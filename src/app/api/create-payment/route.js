export const dynamic = 'force-dynamic';
import { MercadoPagoConfig, Preference } from 'mercadopago';


export async function POST(request) {
  try {
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preference = new Preference(client);
    const body = await request.json();
    const { items, title, price, quantity, payer, metadata } = body;
    const baseUrl = new URL(request.url).origin;

    let paymentItems;
    if (items && Array.isArray(items) && items.length > 0) {
      paymentItems = items.map((item, index) => ({
        id: `product-${Date.now()}-${index}`,
        title: item.title,
        description: item.description || item.title,
        category_id: 'services',
        unit_price: Number(item.unit_price || item.price),
        quantity: Number(item.quantity || 1),
      }));
    } else if (title && price && quantity) {
      paymentItems = [{
        id: metadata?.productId || `product-${Date.now()}`,
        title,
        description: metadata?.description || title,
        category_id: metadata?.category || 'services',
        unit_price: Number(price),
        quantity: Number(quantity),
      }];
    } else {
      return Response.json({ error: 'Faltan datos requeridos: items o title/price/quantity' }, { status: 400 });
    }

    const externalReference = `STORE-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const preferenceData = {
      external_reference: externalReference,
      items: paymentItems,
      payer: payer || {},
      back_urls: {
        success: `${baseUrl}/?payment=success`,
        failure: `${baseUrl}/?payment=failure`,
        pending: `${baseUrl}/?payment=pending`,
      },
      auto_return: 'approved',
      metadata: { ...(metadata || {}), external_reference: externalReference },
      notification_url: `${baseUrl}/api/payment-webhook`,
    };

    const response = await preference.create({ body: preferenceData });
    return Response.json({ id: response.id, init_point: response.init_point });
  } catch (error) {
    console.error('Error creando preferencia de pago:', error);
    return Response.json({ error: 'Error al crear la preferencia de pago', details: error.message }, { status: 500 });
  }
}
