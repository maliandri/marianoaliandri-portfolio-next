import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const preference = new Preference(client);

export async function POST(request) {
  try {
    const { email, cvAnalysis } = await request.json();
    const baseUrl = new URL(request.url).origin;

    if (!email || !cvAnalysis) {
      return Response.json({ error: 'Email y análisis de CV requeridos' }, { status: 400 });
    }

    const priceARS = 1000;
    const externalReference = `CV-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const preferenceData = {
      external_reference: externalReference,
      items: [{
        id: 'cv-analysis-ats',
        title: 'Informe Detallado de Análisis ATS',
        description: 'Análisis profesional de CV contra sistemas ATS con recomendaciones personalizadas',
        category_id: 'services',
        unit_price: priceARS,
        quantity: 1,
      }],
      payer: { email },
      back_urls: {
        success: `${baseUrl}/?payment=success&type=cv`,
        failure: `${baseUrl}/?payment=failure`,
        pending: `${baseUrl}/?payment=pending`,
      },
      auto_return: 'approved',
      metadata: {
        type: 'cv_analysis',
        email,
        cvAnalysis: JSON.stringify(cvAnalysis),
        timestamp: new Date().toISOString(),
        external_reference: externalReference,
      },
      notification_url: `${baseUrl}/api/payment-webhook`,
    };

    const response = await preference.create({ body: preferenceData });
    return Response.json({ id: response.id, init_point: response.init_point });
  } catch (error) {
    console.error('Error creando preferencia de pago CV:', error);
    return Response.json({ error: 'Error al crear la preferencia de pago', details: error.message }, { status: 500 });
  }
}
