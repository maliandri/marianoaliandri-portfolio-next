// Cloudinary Upload Service
// Servicio para subir imágenes a Cloudinary

class CloudinaryService {
  constructor() {
    this.cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    this.uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    this.uploadURL = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
  }

  /**
   * Redimensionar imagen Base64 a formato cuadrado 1080x1080 (Instagram compatible)
   * @param {string} base64Image - Imagen en formato Base64 (data:image/...)
   * @returns {Promise<string>} Imagen redimensionada en Base64
   */
  async resizeImageToSquare(base64Image) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Crear canvas de 1080x1080
        const canvas = document.createElement('canvas');
        const size = 1080;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Calcular dimensiones para crop centrado
        const scale = Math.max(size / img.width, size / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (size - scaledWidth) / 2;
        const y = (size - scaledHeight) / 2;

        // Rellenar con blanco por si hay transparencia
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        // Dibujar imagen centrada y escalada
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // Convertir a Base64
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.92);
        resolve(resizedBase64);
      };
      img.onerror = () => reject(new Error('Error al cargar imagen para redimensionar'));
      img.src = base64Image;
    });
  }

  /**
   * Subir imagen Base64 a Cloudinary
   * @param {string} base64Image - Imagen en formato Base64 (data:image/...)
   * @param {string} folder - Carpeta en Cloudinary (opcional)
   * @returns {Promise<string>} URL de la imagen en Cloudinary
   */
  async uploadBase64Image(base64Image, folder = 'social-media') {
    try {
      console.log('📤 Subiendo imagen a Cloudinary...');

      // Redimensionar a formato cuadrado 1080x1080 para Instagram
      console.log('🔄 Redimensionando imagen a 1080x1080 para Instagram...');
      const resizedImage = await this.resizeImageToSquare(base64Image);

      const formData = new FormData();
      formData.append('file', resizedImage);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', folder);

      const response = await fetch(this.uploadURL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Error al subir imagen: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Imagen subida exitosamente:', data.secure_url);

      return data.secure_url;
    } catch (error) {
      console.error('❌ Error al subir imagen a Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Verificar si una URL es Base64
   * @param {string} url - URL a verificar
   * @returns {boolean} true si es Base64
   */
  isBase64(url) {
    return url && (url.startsWith('data:image/') || url.startsWith('data:video/'));
  }

  /**
   * Subir video Base64 a Cloudinary
   * @param {string} base64Video - Video en formato Base64 (data:video/...)
   * @param {string} folder - Carpeta en Cloudinary (opcional)
   * @returns {Promise<string>} URL del video en Cloudinary
   */
  async uploadBase64Video(base64Video, folder = 'reels') {
    try {
      console.log('📤 Subiendo video a Cloudinary...');

      const videoUploadURL = `https://api.cloudinary.com/v1_1/${this.cloudName}/video/upload`;

      const formData = new FormData();
      formData.append('file', base64Video);
      formData.append('upload_preset', this.uploadPreset);
      formData.append('folder', folder);
      formData.append('resource_type', 'video');

      const response = await fetch(videoUploadURL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al subir video: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Video subido exitosamente:', data.secure_url);

      return data.secure_url;
    } catch (error) {
      console.error('❌ Error al subir video a Cloudinary:', error);
      throw error;
    }
  }
}

// Exportar instancia única
const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
