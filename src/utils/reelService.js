// Reel Generation Service
// Genera videos cortos (reels) desde imágenes de productos usando Shotstack

class ReelService {
  /**
   * Generar video (reel) desde una imagen usando Shotstack API via Netlify Functions
   * @param {string} imageUrl - URL de la imagen del producto
   * @param {Object} options - Opciones de generación
   * @returns {Promise<Object>} { renderId, statusUrl } para consultar el estado
   */
  async generateReelFromImage(imageUrl, options = {}) {
    const {
      productName = '',
      price = ''
    } = options;

    if (!imageUrl) {
      console.error('imageUrl is required');
      return null;
    }

    console.log('🎬 Solicitando generación de video a Shotstack...');
    console.log('📸 Imagen:', imageUrl);
    console.log('📦 Producto:', productName);
    console.log('💰 Precio:', price);

    try {
      // Llamar a la Netlify Function que genera el video con Shotstack
      const response = await fetch('/.netlify/functions/generate-reel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageUrl,
          productName,
          price
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error generando video:', error);
        return null;
      }

      const result = await response.json();
      console.log('✅ Video solicitado. Render ID:', result.renderId);

      return {
        renderId: result.renderId,
        statusUrl: result.statusUrl
      };

    } catch (error) {
      console.error('❌ Error llamando a generate-reel function:', error);
      return null;
    }
  }

  /**
   * Consultar el estado de un video en proceso de generación
   * @param {string} renderId - ID del render devuelto por generateReelFromImage
   * @returns {Promise<Object>} { status, videoUrl }
   */
  async checkReelStatus(renderId) {
    if (!renderId) {
      console.error('renderId is required');
      return null;
    }

    try {
      const response = await fetch(`/.netlify/functions/check-reel-status?renderId=${renderId}`);

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error consultando estado:', error);
        return null;
      }

      const result = await response.json();
      return {
        status: result.status, // 'queued', 'rendering', 'done', 'failed'
        videoUrl: result.videoUrl // Solo disponible cuando status = 'done'
      };

    } catch (error) {
      console.error('❌ Error llamando a check-reel-status function:', error);
      return null;
    }
  }

  /**
   * Esperar a que el video esté listo (polling)
   * @param {string} renderId - ID del render
   * @param {number} maxWaitTime - Tiempo máximo de espera en ms (default: 60000 = 1 min)
   * @returns {Promise<string>} URL del video generado
   */
  async waitForVideoReady(renderId, maxWaitTime = 60000) {
    const startTime = Date.now();
    const pollInterval = 3000; // Consultar cada 3 segundos

    console.log('⏳ Esperando a que el video esté listo...');

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.checkReelStatus(renderId);

      if (!status) {
        throw new Error('Error consultando estado del video');
      }

      console.log(`📊 Estado: ${status.status}`);

      if (status.status === 'done') {
        console.log('✅ Video listo!', status.videoUrl);
        return status.videoUrl;
      }

      if (status.status === 'failed') {
        throw new Error('La generación del video falló');
      }

      // Esperar antes de volver a consultar
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Timeout esperando a que el video esté listo');
  }
}

// Exportar instancia única
const reelService = new ReelService();
export default reelService;
