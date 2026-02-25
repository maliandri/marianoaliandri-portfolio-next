import { MercadoPagoConfig, Preference } from 'mercadopago';

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});
const preference = new Preference(client);

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: responseHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { items, title, price, quantity, payer, metadata } = body;

    // Soportar ambos formatos: items (array) o title/price/quantity (individual)
    let paymentItems;

    if (items && Array.isArray(items) && items.length > 0) {
      // Formato del Cart: array de items
      paymentItems = items.map((item, index) => ({
        id: `product-${Date.now()}-${index}`,
        title: item.title,
        description: item.description || item.title,
        category_id: 'services',
        unit_price: Number(item.unit_price || item.price),
        quantity: Number(item.quantity || 1),
      }));
    } else if (title && price && quantity) {
      // Formato legacy: item individual
      paymentItems = [{
        id: metadata?.productId || `product-${Date.now()}`,
        title: title,
        description: metadata?.description || title,
        category_id: metadata?.category || 'services',
        unit_price: Number(price),
        quantity: Number(quantity),
      }];
    } else {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({ error: 'Faltan datos requeridos: items o title/price/quantity' })
      };
    }

    // Generar ID único para la transacción
    const externalReference = `STORE-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Crear preferencia de pago
    const preferenceData = {
      external_reference: externalReference,
      items: paymentItems,
      payer: payer || {},
      back_urls: {
        success: `${process.env.URL}/?payment=success`,
        failure: `${process.env.URL}/?payment=failure`,
        pending: `${process.env.URL}/?payment=pending`
      },
      auto_return: 'approved',
      metadata: {
        ...(metadata || {}),
        external_reference: externalReference
      },
      notification_url: `${process.env.URL}/.netlify/functions/payment-webhook`,
    };

    const response = await preference.create({ body: preferenceData });

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        id: response.id,
        init_point: response.init_point,
      })
    };

  } catch (error) {
    console.error('❌ Error creando preferencia de pago:', error);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        error: 'Error al crear la preferencia de pago',
        details: error.message
      })
    };
  }
}
