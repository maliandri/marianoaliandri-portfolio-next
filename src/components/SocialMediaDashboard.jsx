'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import makeService from '../utils/makeService';
import reelService from '../utils/reelService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseservice';
import ReelEditor from './ReelEditor';
import { useExtendedStats } from '../hooks/useFirebaseStats';

/**
 * Social Media Dashboard - Make.com Integration
 * Panel simplificado para publicar en redes sociales via webhooks
 * RESPONSIVE: Optimizado para móvil y desktop
 */
function SocialMediaDashboard() {
  const [activeTab, setActiveTab] = useState('custom'); // custom, products, services, statistics
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // AI Provider selection
  const [aiProvider, setAiProvider] = useState('gemini'); // 'gemini' o 'groq'

  // Custom post state
  const [postText, setPostText] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState(['linkedin', 'facebook']);
  const [useAI, setUseAI] = useState(false); // Toggle para usar AI
  const [customImageUrl, setCustomImageUrl] = useState(''); // URL de imagen para publicación libre
  const [contentType, setContentType] = useState('post'); // 'post' o 'reel'
  const [videoFile, setVideoFile] = useState(null); // Archivo de video para reels
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(''); // URL de preview del video

  // Products state
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showReelEditor, setShowReelEditor] = useState(false);

  // Statistics state
  const [stats, setStats] = useState({
    title: '',
    description: '',
    metrics: {},
    imageUrl: '' // URL de imagen para estadística
  });

  // Firebase stats (productos más visitados, páginas, usuarios)
  const { data: firebaseStats, isLoading: loadingStats, error: statsError } = useExtendedStats();

  const networks = [
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-600' },
    { id: 'facebook', name: 'FB + IG', icon: '👥📷', color: 'bg-blue-700', info: 'Publica en Facebook e Instagram automáticamente' }
  ];

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('📦 SocialMediaDashboard - Productos cargados desde Firebase:', productsData);
      console.log('📦 Total de productos:', productsData.length);
      // Log del producto portfolio específicamente
      const portfolio = productsData.find(p => p.id === 'portfolio');
      if (portfolio) {
        console.log('🎯 Producto Portfolio encontrado:', portfolio);
        console.log('🖼️ Portfolio.image:', portfolio.image);
      }
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const toggleNetwork = (networkId) => {
    setSelectedNetworks(prev =>
      prev.includes(networkId)
        ? prev.filter(id => id !== networkId)
        : [...prev, networkId]
    );
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Manejar pegado de imagen desde clipboard
  const handlePaste = async (e, setImageFn) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();

        reader.onloadend = () => {
          setImageFn(reader.result); // Base64 data URL
          showMessage('success', '📋 Imagen pegada correctamente');
        };

        reader.readAsDataURL(blob);
        break;
      }
    }
  };

  // Manejar carga de archivo de imagen
  const handleFileUpload = async (e, setImageFn) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Por favor selecciona un archivo de imagen');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageFn(reader.result); // Base64 data URL
      showMessage('success', '📷 Imagen cargada correctamente');
    };

    reader.readAsDataURL(file);
  };

  // Manejar carga de archivo de video para Reels
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      showMessage('error', 'Por favor selecciona un archivo de video');
      return;
    }

    // Verificar tamaño (máximo 100MB para reels)
    if (file.size > 100 * 1024 * 1024) {
      showMessage('error', 'El video debe ser menor a 100MB');
      return;
    }

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    showMessage('success', '🎬 Video cargado correctamente');
  };

  // Limpiar video
  const clearVideo = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl('');
  };

  // Generar imagen cuadrada de estadísticas (1080x1080)
  const generateStatisticImage = () => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const size = 1080;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Fondo degradado
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Título
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      const titleLines = wrapText(ctx, stats.title, size - 120, 80);
      titleLines.forEach((line, i) => {
        ctx.fillText(line, size / 2, 180 + (i * 90));
      });

      // Descripción
      ctx.font = '40px Arial';
      const descLines = wrapText(ctx, stats.description, size - 120, 40);
      descLines.forEach((line, i) => {
        ctx.fillText(line, size / 2, 350 + (i * 50));
      });

      // Métricas
      if (Object.keys(stats.metrics).length > 0) {
        ctx.font = 'bold 50px Arial';
        let y = 600;
        Object.entries(stats.metrics).forEach(([key, value]) => {
          ctx.fillText(`${key}: ${value}`, size / 2, y);
          y += 70;
        });
      }

      // Footer
      ctx.font = '35px Arial';
      ctx.fillText('marianoaliandri.com.ar', size / 2, size - 80);

      // Convertir a Base64
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    });
  };

  // Función auxiliar para dividir texto en líneas
  const wrapText = (ctx, text, maxWidth, fontSize) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine.trim());
    return lines;
  };

  // Copiar imagen generada al clipboard
  const handleCopyStatisticImage = async () => {
    try {
      const imageDataUrl = await generateStatisticImage();

      // Convertir Base64 a Blob
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();

      // Copiar al clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      showMessage('success', '📋 Imagen copiada al portapapeles (1080x1080)');
    } catch (error) {
      console.error('Error al copiar imagen:', error);
      showMessage('error', 'Error al copiar imagen');
    }
  };

  const handlePublishCustom = async () => {
    if (!postText.trim()) {
      showMessage('error', 'Por favor escribe algo para publicar');
      return;
    }

    if (selectedNetworks.length === 0) {
      showMessage('error', 'Selecciona al menos una red social');
      return;
    }

    setIsPublishing(true);
    try {
      const result = await makeService.publishCustom(postText, selectedNetworks, customImageUrl || null, useAI, aiProvider);

      if (result.success) {
        showMessage('success', useAI ? '¡Contenido enviado a AI para generar y publicar!' : '¡Publicación enviada correctamente!');
        setPostText('');
        setCustomImageUrl('');
      } else {
        showMessage('error', `Error: ${result.message}`);
      }
    } catch (error) {
      showMessage('error', 'Error al publicar');
    } finally {
      setIsPublishing(false);
    }
  };

  // Publicar Reel personalizado (video cargado por el usuario)
  const handlePublishCustomReel = async () => {
    if (!videoFile) {
      showMessage('error', 'Por favor carga un video para el reel');
      return;
    }

    if (!postText.trim()) {
      showMessage('error', 'Por favor escribe una descripción para el reel');
      return;
    }

    setIsPublishing(true);
    try {
      // Convertir video a base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const videoBase64 = reader.result;

        const result = await makeService.publishCustomReel({
          caption: postText,
          videoBase64: videoBase64,
          networks: selectedNetworks,
          useAI: useAI,
          aiProvider: aiProvider
        });

        if (result.success) {
          showMessage('success', '🎬 ¡Reel enviado correctamente!');
          setPostText('');
          clearVideo();
        } else {
          showMessage('error', `Error: ${result.message}`);
        }
        setIsPublishing(false);
      };
      reader.readAsDataURL(videoFile);
    } catch (error) {
      showMessage('error', 'Error al publicar reel');
      setIsPublishing(false);
    }
  };

  const handlePublishProduct = async () => {
    if (!selectedProduct) {
      showMessage('error', 'Selecciona un producto');
      return;
    }

    setIsPublishing(true);
    try {
      const result = await makeService.publishProduct(selectedProduct, aiProvider);

      if (result.success) {
        showMessage('success', '✨ ¡AI generando contenido del producto y publicando en redes sociales!');
        setSelectedProduct(null);
      } else {
        showMessage('error', `Error: ${result.message}`);
      }
    } catch (error) {
      showMessage('error', 'Error al publicar producto');
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishReel = async () => {
    if (!selectedProduct) {
      showMessage('error', 'Selecciona un producto');
      return;
    }

    if (!selectedProduct.image) {
      showMessage('error', 'El producto necesita una imagen para generar el reel');
      return;
    }

    // Abrir el editor visual
    setShowReelEditor(true);
  };

  const handleReelPublish = async (videoUrl) => {
    try {
      setIsPublishing(true);
      showMessage('info', '📤 Publicando reel en redes sociales...');

      // Publicar el reel con AI caption
      const result = await makeService.publishReel(selectedProduct, videoUrl, aiProvider);

      if (result.success) {
        showMessage('success', '🎬 ¡Reel publicado exitosamente en Instagram!');
        setSelectedProduct(null);
        setShowReelEditor(false);
      } else {
        showMessage('error', `Error al publicar: ${result.message}`);
      }
    } catch (error) {
      console.error('Error al publicar reel:', error);
      showMessage('error', `Error: ${error.message || 'Error al publicar reel'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishStatistic = async () => {
    if (!stats.title || !stats.description) {
      showMessage('error', 'Completa título y descripción');
      return;
    }

    setIsPublishing(true);
    try {
      const result = await makeService.publishStatistic(stats, aiProvider);

      if (result.success) {
        showMessage('success', '✨ ¡AI generando contenido de la estadística y publicando en redes sociales!');
        setStats({ title: '', description: '', metrics: {}, imageUrl: '' });
      } else {
        showMessage('error', `Error: ${result.message}`);
      }
    } catch (error) {
      showMessage('error', 'Error al publicar estadística');
    } finally {
      setIsPublishing(false);
    }
  };

  const testConnection = async () => {
    setIsPublishing(true);
    try {
      const result = await makeService.testConnection();

      if (result.success) {
        showMessage('success', 'Conexión exitosa con Make.com');
      } else {
        showMessage('error', `Error de conexión: ${result.message}`);
      }
    } catch (error) {
      showMessage('error', 'Error al probar conexión');
    } finally {
      setIsPublishing(false);
    }
  };

  const tabs = [
    { id: 'custom', label: 'Libre', fullLabel: 'Publicación Libre', icon: '✍️' },
    { id: 'products', label: 'Productos', fullLabel: 'Productos/Servicios', icon: '🎯' },
    { id: 'statistics', label: 'Stats', fullLabel: 'Estadísticas', icon: '📊' }
  ];

  const templates = {
    service: `💼 ¿Sabías que puedo ayudarte con [servicio]?

✅ [Beneficio 1]
✅ [Beneficio 2]
✅ [Beneficio 3]

Conocé más:
https://marianoaliandri.com.ar

#Servicios #DesarrolloWeb #PowerBI`,

    tip: `💡 Tip profesional:

[Tu consejo aquí]

¿Necesitás ayuda con esto?
https://marianoaliandri.com.ar/#contact

#Tech #Programming #WebDev`,

    achievement: `🎉 ¡Nuevo logro desbloqueado!

[Descripción del logro]

Gracias a todos por el apoyo.

#DesarrolloWeb #Resultados #Éxito`
  };

  const useTemplate = (template) => {
    setPostText(templates[template]);
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header - RESPONSIVE */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Redes Sociales
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Publica via Make.com
          </p>
        </div>
        <button
          onClick={testConnection}
          disabled={isPublishing}
          className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 text-sm"
        >
          🔌 Test Conexión
        </button>
      </div>

      {/* Message Alert */}
      {message.text && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`p-3 sm:p-4 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Tabs - RESPONSIVE */}
      <div className="flex gap-1 sm:gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {tab.icon} <span className="hidden sm:inline">{tab.fullLabel}</span><span className="sm:hidden">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* AI Provider Selector - RESPONSIVE */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-3 sm:p-4 rounded-lg border border-purple-200 dark:border-purple-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              🤖 Motor AI
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Selecciona el motor de AI
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAiProvider('groq')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                aiProvider === 'groq'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              ⚡ Groq
            </button>
            <button
              onClick={() => setAiProvider('gemini')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                aiProvider === 'gemini'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              🧠 Gemini
            </button>
          </div>
        </div>
      </div>

      {/* Network Selector - RESPONSIVE */}
      <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Redes Sociales
        </h3>
        <div className="flex flex-wrap gap-2">
          {networks.map(network => (
            <button
              key={network.id}
              onClick={() => toggleNetwork(network.id)}
              className={`flex-1 sm:flex-none min-w-[100px] px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedNetworks.includes(network.id)
                  ? `${network.color} text-white`
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title={network.info || network.name}
            >
              {network.icon} {network.name}
            </button>
          ))}
        </div>
        {selectedNetworks.includes('facebook') && (
          <div className="mt-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
              ℹ️ <strong>FB + IG:</strong> Post en ambas redes automáticamente
            </p>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          {/* Tipo de contenido: Post o Reel */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 p-3 sm:p-4 rounded-lg border border-pink-200 dark:border-pink-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  📝 Tipo de Contenido
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {contentType === 'post' ? 'Publicación con texto e imagen' : 'Video corto para Reels/Shorts'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setContentType('post'); clearVideo(); }}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    contentType === 'post'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  📄 Post
                </button>
                <button
                  onClick={() => { setContentType('reel'); setCustomImageUrl(''); }}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    contentType === 'reel'
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  🎬 Reel
                </button>
              </div>
            </div>
          </div>

          {/* Templates - RESPONSIVE (solo para posts) */}
          {contentType === 'post' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Templates
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => useTemplate('service')}
                className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
              >
                💼 Servicio
              </button>
              <button
                onClick={() => useTemplate('tip')}
                className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
              >
                💡 Tip
              </button>
              <button
                onClick={() => useTemplate('achievement')}
                className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
              >
                🎉 Logro
              </button>
            </div>
          </div>
          )}

          {/* AI Toggle - RESPONSIVE */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-3 sm:p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                  ✨ Modo AI
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {useAI ? 'AI genera el post' : 'Publica tal cual'}
                </p>
              </div>
              <button
                onClick={() => setUseAI(!useAI)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                  useAI ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    useAI ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Composer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {useAI ? 'Descripción (AI genera contenido)' : 'Texto del Post'}
            </label>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={useAI ? 3 : 6}
              placeholder={useAI
                ? 'Ej: "Nuevo servicio de consultoría en Power BI"'
                : 'Escribe tu publicación aquí...'}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {postText.length} caracteres
            </div>
          </div>

          {/* Imagen (opcional) - Solo para Posts */}
          {contentType === 'post' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Imagen (opcional)
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, setCustomImageUrl)}
                className="w-full text-xs sm:text-sm text-gray-500 dark:text-gray-400 file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/30 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50"
              />
              <div
                onPaste={(e) => handlePaste(e, setCustomImageUrl)}
                className="p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800"
              >
                📋 Pega imagen (Ctrl+V)
              </div>
              {customImageUrl && (
                <div className="relative">
                  <img
                    src={customImageUrl}
                    alt="Preview"
                    className="w-full h-32 sm:h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setCustomImageUrl('')}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 sm:p-2 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Video - Solo para Reels */}
          {contentType === 'reel' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎬 Video del Reel
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="w-full text-xs sm:text-sm text-gray-500 dark:text-gray-400 file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-pink-50 dark:file:bg-pink-900/30 file:text-pink-700 dark:file:text-pink-300 hover:file:bg-pink-100 dark:hover:file:bg-pink-900/50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Formatos: MP4, MOV, WebM • Máximo: 100MB • Duración recomendada: 15-60 seg
              </p>
              {videoPreviewUrl && (
                <div className="relative">
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="w-full h-48 sm:h-64 object-contain rounded-lg bg-black"
                  />
                  <button
                    onClick={clearVideo}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 sm:p-2 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Botón de publicar - diferente para Post y Reel */}
          {contentType === 'post' ? (
          <button
            onClick={handlePublishCustom}
            disabled={isPublishing || !postText.trim()}
            className={`w-full py-3 text-sm sm:text-base ${
              useAI
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPublishing
              ? '⏳ Procesando...'
              : useAI
                ? '✨ Generar y Publicar'
                : '🚀 Publicar'}
          </button>
          ) : (
          <button
            onClick={handlePublishCustomReel}
            disabled={isPublishing || !postText.trim() || !videoFile}
            className="w-full py-3 text-sm sm:text-base bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing
              ? '⏳ Subiendo Reel...'
              : '🎬 Publicar Reel'}
          </button>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seleccionar Producto
            </label>
            <select
              value={selectedProduct?.id || ''}
              onChange={(e) => {
                const product = products.find(p => p.id === e.target.value);
                setSelectedProduct(product);
              }}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">-- Seleccionar --</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - ${product.priceARS ? `ARS ${product.priceARS}` : product.priceUSD ? `USD ${product.priceUSD}` : 'Consultar'}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">
                Vista Previa
              </h3>
              <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {`🎯 ${selectedProduct.name}

${selectedProduct.description?.substring(0, 100)}...

💰 ${selectedProduct.priceARS ? `ARS $${selectedProduct.priceARS}` : selectedProduct.priceUSD ? `USD $${selectedProduct.priceUSD}` : 'Consultar'}`}
              </div>
            </div>
          )}

          {/* Botones de acción - RESPONSIVE */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePublishProduct}
              disabled={isPublishing || !selectedProduct}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isPublishing ? '⏳ Publicando...' : '🚀 Publicar Post'}
            </button>
            <button
              onClick={handlePublishReel}
              disabled={isPublishing || !selectedProduct}
              className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isPublishing ? '⏳ Generando...' : '🎬 Crear Reel'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="space-y-4">
          {/* Estadísticas en tiempo real de Firebase */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              📊 Estadísticas en Tiempo Real
              {loadingStats && <span className="animate-pulse text-xs text-indigo-500">Cargando...</span>}
              {statsError && <span className="text-xs text-red-500">Error al cargar</span>}
            </h3>

            {!loadingStats && !firebaseStats && !statsError && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded">
                No hay datos de estadísticas disponibles todavía.
              </div>
            )}

            {firebaseStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {firebaseStats.totalVisits?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Visitas Totales</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {firebaseStats.uniqueVisitors?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Visitantes Únicos</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {firebaseStats.registeredUsers?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Usuarios Registrados</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                    {firebaseStats.likes || 0} / {firebaseStats.dislikes || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Likes / Dislikes</div>
                </div>
              </div>
            )}

            {/* Páginas más visitadas */}
            {firebaseStats && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">📄 Páginas más visitadas</h4>
                {firebaseStats.topPages?.length > 0 ? (
                  <div className="space-y-1">
                    {firebaseStats.topPages.slice(0, 5).map((page, index) => (
                      <div key={page.id || index} className="flex justify-between items-center text-xs bg-white dark:bg-gray-800 px-3 py-2 rounded">
                        <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{page.path || page.title || page.id}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium ml-2">{page.views || page.count || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 dark:text-gray-500 italic">Sin datos de páginas</div>
                )}
              </div>
            )}

            {/* Productos más visitados */}
            {firebaseStats && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">🎯 Productos más visitados</h4>
                {firebaseStats.topProducts?.length > 0 ? (
                  <div className="space-y-1">
                    {firebaseStats.topProducts.slice(0, 5).map((product, index) => (
                      <div key={product.id || index} className="flex justify-between items-center text-xs bg-white dark:bg-gray-800 px-3 py-2 rounded">
                        <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{product.productName || product.name || product.id}</span>
                        <span className="text-purple-600 dark:text-purple-400 font-medium ml-2">{product.views || product.count || 0}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 dark:text-gray-500 italic">Sin datos de productos</div>
                )}
              </div>
            )}

            {/* Botón para copiar estadísticas al formulario */}
            {firebaseStats && (
              <button
                onClick={() => {
                  const metricsObj = {
                    'Visitas': firebaseStats.totalVisits?.toLocaleString() || '0',
                    'Visitantes únicos': firebaseStats.uniqueVisitors?.toLocaleString() || '0',
                    'Usuarios registrados': firebaseStats.registeredUsers?.toLocaleString() || '0'
                  };
                  setStats({
                    ...stats,
                    title: `📊 ${firebaseStats.totalVisits?.toLocaleString() || 0} visitas en marianoaliandri.com.ar`,
                    description: `Mi portfolio alcanzó ${firebaseStats.uniqueVisitors?.toLocaleString() || 0} visitantes únicos y ${firebaseStats.registeredUsers?.toLocaleString() || 0} usuarios registrados. ¡Gracias por el apoyo!`,
                    metrics: metricsObj
                  });
                  showMessage('success', '📊 Estadísticas copiadas al formulario');
                }}
                className="w-full py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
              >
                📋 Usar estas estadísticas para publicar
              </button>
            )}
          </div>

          {/* Formulario de publicación */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Título
              </label>
              <input
                type="text"
                value={stats.title}
                onChange={(e) => setStats({ ...stats, title: e.target.value })}
                placeholder="Ej: 10,000 visitantes"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción
              </label>
              <textarea
                value={stats.description}
                onChange={(e) => setStats({ ...stats, description: e.target.value })}
                rows={3}
                placeholder="Descripción..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Métricas (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Visitantes: 10,000 (Enter para agregar)"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2 text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const [key, value] = e.target.value.split(':');
                    if (key && value) {
                      setStats({
                        ...stats,
                        metrics: { ...stats.metrics, [key.trim()]: value.trim() }
                      });
                      e.target.value = '';
                    }
                  }
                }}
              />
              {Object.keys(stats.metrics).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  {Object.entries(stats.metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-xs sm:text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">✅ {key}: {value}</span>
                      <button
                        onClick={() => {
                          const newMetrics = { ...stats.metrics };
                          delete newMetrics[key];
                          setStats({ ...stats, metrics: newMetrics });
                        }}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Imagen - RESPONSIVE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Imagen (opcional)
              </label>
              {stats.imageUrl ? (
                <div className="relative w-full max-w-xs mx-auto aspect-square rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
                  <img
                    src={stats.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-contain bg-white"
                  />
                  <button
                    onClick={() => setStats({ ...stats, imageUrl: '' })}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  onPaste={(e) => handlePaste(e, (url) => setStats({ ...stats, imageUrl: url }))}
                  className="p-4 border-2 border-dashed border-indigo-300 dark:border-indigo-600 rounded-lg text-center text-xs sm:text-sm text-gray-600 dark:text-gray-300 bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  📋 Pega tu imagen aquí (Ctrl+V)
                </div>
              )}
            </div>

            <button
              onClick={handlePublishStatistic}
              disabled={isPublishing || !stats.title || !stats.description}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isPublishing ? '⏳ Publicando...' : '🚀 Publicar Estadística'}
            </button>
          </div>
        </div>
      )}

      {/* Reel Editor Modal */}
      {showReelEditor && selectedProduct && (
        <ReelEditor
          product={selectedProduct}
          onClose={() => setShowReelEditor(false)}
          onPublish={handleReelPublish}
        />
      )}
    </div>
  );
}

export default SocialMediaDashboard;
