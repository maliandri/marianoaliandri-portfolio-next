// Make.com Webhook Service
// Servicio simple para publicar en redes sociales via Make.com
import cloudinaryService from './cloudinaryService';

class MakeService {
  constructor() {
    // Webhook URL de Make.com (único para evitar límite de webhooks en plan gratuito)
    // El Router en Make.com decide qué AI usar según el campo aiProvider del payload
    this.webhookURL = 'https://hook.us2.make.com/t9o6h2qpt85npf78qc52lgx6gpukza2i';
  }

  /**
   * Publicar en redes sociales via Make.com
   * @param {Object} data - Datos del post
   * @param {string} data.text - Texto del post
   * @param {Array} data.networks - Redes sociales ['linkedin', 'facebook']
   * @param {string} data.type - Tipo de contenido ['product', 'service', 'statistic', 'custom']
   * @param {string} data.imageUrl - URL de imagen (opcional)
   * @param {string} data.aiProvider - 'gemini' o 'groq' (opcional, default: 'groq')
   * @param {Object} data.metadata - Metadata adicional (opcional)
   */
  async publish(data) {
    // Seleccionar proveedor de AI
    const aiProvider = data.aiProvider || 'groq';

    console.log(`🤖 Usando AI: ${aiProvider.toUpperCase()}`);

    try {
      // Si hay imagen Base64, subirla a Cloudinary primero
      let imageUrl = data.imageUrl || null;
      let wasPastedImage = false; // Flag para indicar si era imagen pegada

      if (imageUrl && cloudinaryService.isBase64(imageUrl)) {
        console.log('🔄 Detectada imagen Base64, subiendo a Cloudinary...');
        wasPastedImage = true; // Marcar como imagen pegada
        try {
          imageUrl = await cloudinaryService.uploadBase64Image(imageUrl);
          console.log('✅ Imagen subida a Cloudinary:', imageUrl);
        } catch (error) {
          console.error('❌ Error al subir imagen, usando placeholder:', error);
          // Si falla, usar placeholder
          const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
          imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/v1735959487/default-statistic_placeholder.jpg`;
        }
      }

      const payload = {
        // Texto del post - múltiples campos para compatibilidad con diferentes módulos de Make.com
        text: data.text,
        content: data.text, // LinkedIn Video Post espera 'content'
        caption: data.text, // Facebook/Instagram Reel esperan 'caption'
        description: data.text, // Algunos módulos usan 'description'
        message: data.text, // Facebook Pages usa 'message'

        networks: data.networks || ['linkedin', 'facebook'],
        type: data.type || 'custom',
        timestamp: new Date().toISOString(),
        imageUrl,
        useAI: data.useAI || false, // Indica si debe procesar con AI
        wasPastedImage, // Indica si la imagen fue pegada (Base64 → Cloudinary)
        aiProvider, // Pasar el proveedor de AI a la función
        metadata: data.metadata || {}
      };

      // Solo incluir 'url' si hay un video (reels)
      if (data.url) {
        payload.url = data.url;
        payload.video_url = data.url; // Alias para módulos que esperan 'video_url'
        payload.videoUrl = data.url; // Alias camelCase
        payload.source = data.url; // Facebook Reel API usa 'source'
      }

      console.log('📤 PAYLOAD ENVIADO A NETLIFY FUNCTION:', JSON.stringify(payload, null, 2));

      // Llamar a la Netlify Function en lugar de Make.com directamente
      const response = await fetch('/.netlify/functions/publish-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en la función de publicación');
      }

      return {
        success: true,
        message: 'Publicación enviada correctamente',
        data: { sent: true }
      };
    } catch (error) {
      console.error('Error publishing to Make.com:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  /**
   * Publicar un producto (AI generará el contenido)
   */
  async publishProduct(product, aiProvider = 'groq') {
    console.log('🔍 DEBUG publishProduct - Producto recibido:', product);
    console.log('🖼️ DEBUG - product.image:', product.image);
    console.log('🖼️ DEBUG - product.imageUrl:', product.imageUrl);

    // Usar precio en pesos argentinos o USD
    const price = product.priceARS || product.priceUSD || 'Consultar';
    const currency = product.priceARS ? 'ARS' : (product.priceUSD ? 'USD' : '');

    // Enviamos descripción breve para que AI genere el post
    const briefDescription = `Producto: ${product.name}. ${product.description}. Precio: ${currency ? currency + ' ' : ''}$${price}`;

    // Usar imagen del producto o una genérica de placeholder
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
    const productImage = product.image || `https://res.cloudinary.com/${cloudName}/image/upload/v1735959487/default-product_n0fmqm.jpg`;

    console.log('✅ DEBUG - Imagen final a enviar:', productImage);

    return this.publish({
      text: briefDescription,
      type: 'product',
      useAI: true, // AI procesará esto
      imageUrl: productImage,
      aiProvider, // Pasar el proveedor de AI
      metadata: {
        productId: product.id,
        productName: product.name,
        productDescription: product.description,
        price: price,
        currency: currency,
        productUrl: 'https://marianoaliandri.com.ar/#tienda',
        productImage: productImage
      }
    });
  }

  /**
   * Publicar una estadística del sitio (AI generará el contenido)
   */
  async publishStatistic(stat, aiProvider = 'groq') {
    console.log('🔍 DEBUG publishStatistic - Estadística recibida:', stat);
    console.log('🖼️ DEBUG - stat.imageUrl:', stat.imageUrl);

    // Enviamos info para que AI genere el post
    const briefDescription = `Estadística: ${stat.title}. ${stat.description}. ${
      stat.metrics ? 'Métricas: ' + Object.entries(stat.metrics).map(([key, value]) => `${key}: ${value}`).join(', ') : ''
    }`;

    // Usar imagen del usuario o placeholder
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
    const statisticImage = stat.imageUrl || `https://res.cloudinary.com/${cloudName}/image/upload/v1735959487/default-statistic_placeholder.jpg`;

    console.log('✅ DEBUG - Imagen final a enviar:', statisticImage);

    return this.publish({
      text: briefDescription,
      type: 'statistic',
      useAI: true, // AI procesará esto
      imageUrl: statisticImage,
      aiProvider, // Pasar el proveedor de AI
      metadata: {
        title: stat.title,
        description: stat.description,
        metrics: stat.metrics || {},
        siteUrl: 'https://marianoaliandri.com.ar',
        productName: stat.title // Para image caption
      }
    });
  }

  /**
   * Publicar un servicio (AI generará el contenido)
   */
  async publishService(service) {
    // Enviamos info para que AI genere el post
    const briefDescription = `Servicio: ${service.title}. ${service.description}. ${
      service.benefits ? 'Beneficios: ' + service.benefits.join(', ') : ''
    }`;

    // Imagen placeholder para servicios
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
    const serviceImage = `https://res.cloudinary.com/${cloudName}/image/upload/v1735959487/default-service_placeholder.jpg`;

    return this.publish({
      text: briefDescription,
      type: 'service',
      useAI: true, // AI procesará esto
      imageUrl: serviceImage,
      metadata: {
        serviceId: service.id || service.title,
        serviceName: service.title,
        serviceDescription: service.description,
        benefits: service.benefits || [],
        serviceUrl: 'https://marianoaliandri.com.ar/#servicios'
      }
    });
  }

  /**
   * Publicar contenido personalizado
   */
  async publishCustom(text, networks = null, imageUrl = null, useAI = false, aiProvider = 'groq') {
    return this.publish({
      text,
      type: 'custom',
      networks: networks || ['linkedin', 'facebook'],
      imageUrl,
      useAI,
      aiProvider
    });
  }

  /**
   * Publicar un reel/video personalizado (video cargado por el usuario)
   * @param {Object} data - Datos del reel
   * @param {string} data.caption - Texto/descripción del reel
   * @param {string} data.videoBase64 - Video en formato Base64
   * @param {Array} data.networks - Redes sociales
   * @param {boolean} data.useAI - Si debe generar caption con AI
   * @param {string} data.aiProvider - Proveedor de AI
   */
  async publishCustomReel(data) {
    console.log('🎬 publishCustomReel - Iniciando...');

    try {
      // Subir video a Cloudinary
      let videoUrl = null;
      if (data.videoBase64) {
        console.log('📤 Subiendo video a Cloudinary...');
        try {
          videoUrl = await cloudinaryService.uploadBase64Video(data.videoBase64);
          console.log('✅ Video subido:', videoUrl);
        } catch (error) {
          console.error('❌ Error subiendo video:', error);
          return {
            success: false,
            message: 'Error al subir el video: ' + error.message
          };
        }
      }

      if (!videoUrl) {
        return {
          success: false,
          message: 'No se pudo procesar el video'
        };
      }

      // Enviar a Make.com
      return this.publish({
        text: data.useAI
          ? `REEL personalizado: ${data.caption}. Genera un caption CORTO y VIRAL para reel/video (máximo 100 palabras).`
          : data.caption,
        type: 'reel',
        networks: data.networks || ['facebook'], // Reels van a FB/IG
        useAI: data.useAI || false,
        url: videoUrl,
        imageUrl: null,
        aiProvider: data.aiProvider || 'gemini',
        metadata: {
          format: 'reel',
          videoUrl: videoUrl,
          customReel: true
        }
      });
    } catch (error) {
      console.error('❌ Error en publishCustomReel:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Publicar un reel/video de producto (AI generará el caption)
   */
  async publishReel(product, videoUrl, aiProvider = 'groq') {
    console.log('🎬 DEBUG publishReel - Producto:', product);
    console.log('🎥 DEBUG - Video URL:', videoUrl);

    // Usar precio en pesos argentinos o USD
    const price = product.priceARS || product.priceUSD || 'Consultar';
    const currency = product.priceARS ? 'ARS' : (product.priceUSD ? 'USD' : '');

    // Enviamos descripción breve para que AI genere el caption del reel
    const briefDescription = `REEL de producto: ${product.name}. ${product.description}. Precio: ${currency ? currency + ' ' : ''}$${price}. Genera un caption CORTO y VIRAL para reel/video (máximo 100 palabras).`;

    return this.publish({
      text: briefDescription,
      type: 'reel',
      useAI: true, // AI generará caption corto para reel
      url: videoUrl, // URL del video generado (Make.com espera 'url')
      imageUrl: null, // Los reels usan video, no imagen
      aiProvider, // Pasar el proveedor de AI
      metadata: {
        productId: product.id,
        productName: product.name,
        productDescription: product.description,
        price: price,
        currency: currency,
        productUrl: 'https://marianoaliandri.com.ar/#tienda',
        videoUrl: videoUrl,
        format: 'reel'
      }
    });
  }

  /**
   * Test de conexión con Make.com
   */
  async testConnection(aiProvider = 'groq') {
    try {
      const testData = {
        text: '🧪 Test de conexión desde el panel de administración',
        networks: ['linkedin'],
        type: 'test',
        timestamp: new Date().toISOString(),
        aiProvider
      };

      const response = await fetch('/.netlify/functions/publish-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en test de conexión');
      }

      return {
        success: true,
        status: 200,
        message: 'Conexión exitosa'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }
}

// Exportar instancia única
const makeService = new MakeService();
export default makeService;
