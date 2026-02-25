import { MercadoPagoConfig, Preference } from 'mercadopago';

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
    const { email, cvAnalysis } = JSON.parse(event.body);

    if (!email || !cvAnalysis) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({ error: 'Email y análisis de CV requeridos' })
      };
    }

    // Precio de $1.000 ARS para procesamiento de CV
    const priceARS = 1000;

    // Generar ID único para la transacción
    const externalReference = `CV-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Crear preferencia de pago
    const preferenceData = {
      external_reference: externalReference,
      items: [
        {
          id: 'cv-analysis-ats',
          title: 'Informe Detallado de Análisis ATS',
          description: 'Análisis profesional de CV contra sistemas ATS con recomendaciones personalizadas',
          category_id: 'services',
          unit_price: priceARS,
          quantity: 1,
        }
      ],
      payer: {
        email: email
      },
      back_urls: {
        success: `${process.env.URL}/?payment=success&type=cv`,
        failure: `${process.env.URL}/?payment=failure`,
        pending: `${process.env.URL}/?payment=pending`
      },
      auto_return: 'approved',
      metadata: {
        type: 'cv_analysis',
        email: email,
        cvAnalysis: JSON.stringify(cvAnalysis),
        timestamp: new Date().toISOString(),
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
    console.error('❌ Error creando preferencia de pago CV:', error);
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
