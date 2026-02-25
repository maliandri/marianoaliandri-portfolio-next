import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import admin from 'firebase-admin';

// Inicializar Firebase Admin si no está inicializado
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

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});
const payment = new Payment(client);

// Verificar firma del webhook
function verifyWebhookSignature(event) {
  const xSignature = event.headers['x-signature'];
  const xRequestId = event.headers['x-request-id'];

  if (!xSignature || !xRequestId) {
    console.log('⚠️ Headers de firma no encontrados');
    return true; // En modo prueba, permitir sin firma
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.log('⚠️ MERCADOPAGO_WEBHOOK_SECRET no configurado');
    return true; // Permitir si no está configurado (modo desarrollo)
  }

  try {
    // Parse del body para obtener el data.id
    const body = JSON.parse(event.body);
    const dataId = body.data?.id || body.id;

    const parts = xSignature.split(',');
    const ts = parts.find(p => p.startsWith('ts=')).replace('ts=', '');
    const hash = parts.find(p => p.startsWith('v1=')).replace('v1=', '');

    // El manifest debe usar data.id, no el body completo
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const calculatedHash = hmac.digest('hex');
    const isValid = calculatedHash === hash;
    console.log(`🔐 Verificación de firma: ${isValid ? 'VÁLIDA' : 'INVÁLIDA'}`);
    console.log(`   Data ID: ${dataId}, Request ID: ${xRequestId}, TS: ${ts}`);
    return isValid;
  } catch (error) {
    console.error('❌ Error verificando firma:', error);
    return true; // En caso de error, permitir (modo desarrollo)
  }
}

// Enviar email con análisis de CV usando la función send-cv-analysis
async function sendCVAnalysisEmail(paymentData) {
  console.log('📧 Iniciando envío de email de análisis CV');
  console.log('Payment ID:', paymentData.id);
  console.log('Metadata:', paymentData.metadata);

  const metadata = paymentData.metadata;

  if (!metadata || !metadata.cvAnalysis) {
    throw new Error('Metadata o cvAnalysis no encontrado en el pago');
  }

  const cvAnalysis = JSON.parse(metadata.cvAnalysis);
  console.log('CV Analysis parseado:', cvAnalysis.length, 'resultados');

  console.log('📤 Llamando a función send-cv-analysis');
  console.log('Email destinatario:', metadata.email);

  // Llamar a la función de envío de email
  const response = await fetch(`${process.env.URL}/.netlify/functions/send-cv-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: metadata.email,
      cvAnalysis: cvAnalysis,
      paymentId: paymentData.id,
      amount: paymentData.transaction_amount,
      timestamp: metadata.timestamp
    })
  });

  console.log('📬 Respuesta de send-cv-analysis:');
  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);

  const responseData = await response.json();
  console.log('Response data:', responseData);

  if (!response.ok) {
    throw new Error(`Error enviando email: ${response.status} - ${responseData.error || response.statusText}`);
  }

  console.log('✅ Email de análisis enviado exitosamente');
  console.log('Email ID:', responseData.emailId);
  return response;
}

// Guardar orden de CV en Firestore
async function saveCVOrder(paymentData) {
  const metadata = paymentData.metadata;
  console.log('💾 Guardando orden de CV en Firestore');

  try {
    const orderData = {
      paymentId: paymentData.id,
      type: 'cv_analysis',
      customerEmail: metadata.email,
      status: paymentData.status,
      totalARS: paymentData.transaction_amount,
      items: [
        {
          name: 'Informe Detallado de Análisis ATS',
          quantity: 1,
          priceARS: paymentData.transaction_amount
        }
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: paymentData.payment_type_id,
      externalReference: metadata.external_reference || paymentData.external_reference
    };

    // Guardar en Firestore con el payment ID como documento
    await db.collection('orders').doc(`CV-${paymentData.id}`).set(orderData);

    console.log('✅ Orden de CV guardada en Firestore:', `CV-${paymentData.id}`);
  } catch (error) {
    console.error('❌ Error guardando orden de CV:', error);
    throw error;
  }
}

// Guardar orden de tienda en base de datos (placeholder)
async function saveStoreOrder(paymentData) {
  const metadata = paymentData.metadata;
  console.log('💾 Guardando orden de tienda:', {
    type: metadata.type,
    company: metadata.company,
    email: paymentData.payer?.email,
    amount: paymentData.transaction_amount
  });

  // TODO: Aquí puedes:
  // - Guardar en Firestore
  // - Enviar email de confirmación al cliente
  // - Notificar al equipo de ventas
}

export async function handler(event) {
  try {
    console.log('📬 Webhook unificado recibido de Mercado Pago');
    console.log('Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    console.log('Raw body length:', event.body?.length || 0);
    console.log('Raw body:', event.body);

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body);
      console.log('✅ Body parseado correctamente');
    } catch (parseError) {
      console.error('❌ Error parseando body:', parseError);
      console.log('Body string:', event.body);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

    console.log('Body completo:', JSON.stringify(body, null, 2));
    console.log('Body type:', body.type);
    console.log('Body action:', body.action);
    console.log('Body data:', body.data);
    console.log('Body data.id:', body.data?.id);
    console.log('Body id:', body.id);

    // Verificar firma solo si tenemos un data.id válido
    const dataId = body.data?.id || body.id;
    if (!dataId) {
      console.log('⚠️ Notificación sin data.id - posiblemente una prueba o ping');
      console.log('Tipo de notificación:', body.type);
      console.log('Acción:', body.action);
      // Retornar 200 para notificaciones de test
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, note: 'Test notification' })
      };
    }

    const isValidSignature = verifyWebhookSignature(event);
    if (!isValidSignature) {
      console.log('❌ Firma inválida, rechazando webhook');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    if (body.type === 'payment') {
      const paymentId = body.data.id;
      const paymentData = await payment.get({ id: paymentId });

      console.log('💰 Información del pago:', {
        id: paymentData.id,
        status: paymentData.status,
        status_detail: paymentData.status_detail,
        transaction_amount: paymentData.transaction_amount,
        payer_email: paymentData.payer?.email,
        metadata: paymentData.metadata
      });

      if (paymentData.status === 'approved') {
        console.log('✅ Pago aprobado!');

        const metadata = paymentData.metadata;

        // Detectar el tipo de pago según metadata
        if (metadata && metadata.cvAnalysis) {
          // Es un pago de análisis de CV
          console.log('📄 Tipo: Análisis de CV');
          try {
            // Enviar email con el análisis
            await sendCVAnalysisEmail(paymentData);
            console.log('✅ Email de análisis enviado a:', metadata.email);
          } catch (emailError) {
            console.error('❌ Error enviando email:', emailError);
          }

          try {
            // Guardar orden en Firestore
            await saveCVOrder(paymentData);
            console.log('✅ Orden de CV guardada en Firestore');
          } catch (saveError) {
            console.error('❌ Error guardando orden de CV:', saveError);
          }
        } else if (metadata && (metadata.type || metadata.company)) {
          // Es un pago de la tienda (consultoría)
          console.log('🏪 Tipo: Compra de tienda');
          console.log('📋 Tipo de consulta:', metadata.type);
          console.log('🏢 Empresa:', metadata.company);
          try {
            await saveStoreOrder(paymentData);
          } catch (saveError) {
            console.error('❌ Error guardando orden:', saveError);
          }
        } else {
          // Pago sin metadata específico
          console.log('⚠️ Pago sin metadata de tipo específico');
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('❌ Error en webhook unificado:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
