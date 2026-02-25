'use client';

import { useState } from 'react';

const ReelEditor = ({ product, onClose, onPublish }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [productName, setProductName] = useState(product.name);
  const [price, setPrice] = useState(
    product.priceARS ? `Desde: ARS $${product.priceARS}` :
    product.priceUSD ? `Desde: USD $${product.priceUSD}` : ''
  );
  const [videoUrl, setVideoUrl] = useState(null);

  const handleGenerateAndPublish = async () => {
    try {
      setIsGenerating(true);

      console.log('🎬 Generando reel con:', { productName, price });

      // Paso 1: Generar el video con Shotstack (solo texto + video de fondo + audio)
      const response = await fetch('/.netlify/functions/generate-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName,
          price: price,
          productId: product.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Error response:', errorData);
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Video solicitado. Render ID:', result.renderId);

      // Paso 2: Esperar a que el video esté listo (polling)
      let videoReady = false;
      let attempts = 0;
      const maxAttempts = 40; // 120 segundos max (2 minutos)

      while (!videoReady && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const statusResponse = await fetch(`/.netlify/functions/check-reel-status?renderId=${result.renderId}`);
        const statusData = await statusResponse.json();

        console.log(`📊 Estado (intento ${attempts + 1}):`, statusData.status);

        if (statusData.status === 'done') {
          videoReady = true;
          setVideoUrl(statusData.videoUrl);
          console.log('✅ Video listo:', statusData.videoUrl);

          // Paso 3: Publicar
          if (onPublish) {
            await onPublish(statusData.videoUrl);
          }
        } else if (statusData.status === 'failed') {
          throw new Error('La generación del video falló');
        }

        attempts++;
      }

      if (!videoReady) {
        throw new Error('Timeout esperando el video');
      }

    } catch (error) {
      console.error('❌ Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
      {!videoUrl ? (
        // Editor Form
        <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full">
          <h2 className="text-white text-2xl font-bold mb-4">Crear Reel - {product.name}</h2>

          <div className="space-y-4">
            {/* Editor de título */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Título del Producto
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                placeholder="Nombre del producto"
              />
              <p className="text-gray-400 text-sm mt-1">
                Este texto aparecerá en la parte superior del reel
              </p>
            </div>

            {/* Editor de precio */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Precio
              </label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
                placeholder="Ej: ARS $1199.99 o USD $99.99"
              />
              <p className="text-gray-400 text-sm mt-1">
                Este texto aparecerá en la parte inferior del reel
              </p>
            </div>

            {/* Info adicional */}
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
              <h3 className="text-blue-300 font-semibold mb-2">ℹ️ Información</h3>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• Duración: 30 segundos</li>
                <li>• Formato: 9:16 (Instagram Reel)</li>
                <li>• Video de fondo aleatorio de Pexels</li>
                <li>• Música de fondo aleatoria</li>
                <li>• Solo texto animado (sin imagen de producto)</li>
              </ul>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleGenerateAndPublish}
                disabled={isGenerating || !productName}
                className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando video... (~30 seg)
                  </span>
                ) : (
                  '🎬 Generar y Publicar Reel'
                )}
              </button>

              <button
                onClick={onClose}
                disabled={isGenerating}
                className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Video Preview
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-white text-2xl font-bold mb-4">✅ Video Generado</h3>
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full rounded-lg mb-4 shadow-2xl"
            style={{ aspectRatio: '9/16' }}
          />
          <button
            onClick={() => {
              setVideoUrl(null);
              onClose();
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
};

export default ReelEditor;
