'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import makeService from '../../utils/makeService';
import reelService from '../../utils/reelService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebaseservice';
import ReelEditor from './ReelEditor';
import { useExtendedStats } from '../../hooks/useFirebaseStats';

/**
 * Social Media Dashboard - Make.com Integration
 * Panel simplificado para publicar en redes sociales via webhooks
 * RESPONSIVE: Optimizado para móvil y desktop
 */
const MAX_CAROUSEL_IMAGES = 10;

function SocialMediaDashboard({ initialTab = null }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'custom'); // custom, products, services, statistics
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // AI Provider selection
  const [aiProvider, setAiProvider] = useState('gemini'); // 'gemini' o 'groq'

  // Custom post state
  const [postText, setPostText] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState(['linkedin', 'facebook']);
  const [useAI, setUseAI] = useState(false); // Toggle para usar AI
  const [customImages, setCustomImages] = useState([]); // URLs de imágenes para publicación libre (hasta 10 = carrusel)
  const [uploadingImages, setUploadingImages] = useState(false);
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

  // Proyectos state
  const [proyectos, setProyectos] = useState([]);
  const [loadingProyectos, setLoadingProyectos] = useState(false);
  const [publishingProyectoId, setPublishingProyectoId] = useState(null);

  // Firebase stats (productos más visitados, páginas, usuarios)
  const { data: firebaseStats, isLoading: loadingStats, error: statsError } = useExtendedStats();

  const networks = [
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-600' },
    { id: 'facebook', name: 'FB + IG', icon: '👥📷', color: 'bg-blue-700', info: 'Publica en Facebook e Instagram automáticamente' }
  ];

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'proyectos' && proyectos.length === 0) {
      loadProyectos();
    }
  }, [activeTab]);

  const loadProyectos = async () => {
    setLoadingProyectos(true);
    try {
      const res = await fetch('/api/proyectos');
      const data = await res.json();
      if (data.success) setProyectos(data.proyectos);
    } catch (error) {
      console.error('Error cargando proyectos:', error);
    } finally {
      setLoadingProyectos(false);
    }
  };

  const handlePublishProyecto = async (proyecto) => {
    setPublishingProyectoId(proyecto.domain);
    try {
      const result = await makeService.publishProyecto(proyecto, aiProvider);
      if (result.success) {
        showMessage('success', `✅ ${proyecto.domain} enviado a publicar`);
      } else {
        showMessage('error', `Error: ${result.message}`);
      }
    } catch (error) {
      showMessage('error', `Error publicando ${proyecto.domain}`);
    } finally {
      setPublishingProyectoId(null);
    }
  };

  const handlePublishAllProyectos = async () => {
    if (proyectos.length === 0) return;
    setIsPublishing(true);
    try {
      for (const proyecto of proyectos) {
        setPublishingProyectoId(proyecto.domain);
        await makeService.publishProyecto(proyecto, aiProvider);
        await new Promise(r => setTimeout(r, 2500));
      }
      showMessage('success', `✅ ${proyectos.length} proyectos enviados a publicar`);
    } catch (error) {
      showMessage('error', 'Error publicando proyectos');
    } finally {
      setIsPublishing(false);
      setPublishingProyectoId(null);
    }
  };

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

  const isCarousel = customImages.length > 1;

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

  // Subir blob/file a Cloudinary y devolver URL pública
  // Las imágenes se transforman a 4:5 (1080×1350) para cumplir con Instagram
  const uploadToCloudinary = async (file, resourceType = 'image') => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'portfolio_reels');
    formData.append('folder', 'social');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
    if (resourceType !== 'image') return data.secure_url;
    // Insertar transformación 4:5 en la URL para Instagram
    return data.secure_url.replace('/upload/', '/upload/c_fill,ar_4:5,g_auto,w_1080/');
  };

  // Manejar pegado de imagen desde clipboard
  const handlePaste = async (e, setImageFn) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        try {
          showMessage('success', '⏳ Subiendo imagen...');
          const url = await uploadToCloudinary(blob, 'image');
          setImageFn(url);
          showMessage('success', '📋 Imagen subida correctamente');
        } catch {
          showMessage('error', 'Error al subir imagen a Cloudinary');
        }
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

    try {
      showMessage('success', '⏳ Subiendo imagen...');
      const url = await uploadToCloudinary(file, 'image');
      setImageFn(url);
      showMessage('success', '📷 Imagen subida correctamente');
    } catch {
      showMessage('error', 'Error al subir imagen a Cloudinary');
    }
  };

  // Agrega una URL a la lista de imágenes respetando el tope del carrusel
  const addCustomImage = (url) => {
    setCustomImages(prev => (prev.length >= MAX_CAROUSEL_IMAGES ? prev : [...prev, url]));
  };

  const removeCustomImage = (index) => {
    setCustomImages(prev => prev.filter((_, i) => i !== index));
  };

  // Carga múltiple de imágenes para publicación libre (hasta MAX_CAROUSEL_IMAGES)
  const handleMultiFileUpload = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) return;

    const slots = MAX_CAROUSEL_IMAGES - customImages.length;
    if (slots <= 0) {
      showMessage('error', `Máximo ${MAX_CAROUSEL_IMAGES} imágenes por carrusel`);
      return;
    }
    const toUpload = files.slice(0, slots);
    if (files.length > slots) {
      showMessage('error', `Solo entran ${slots} más — se subirán las primeras ${slots}`);
    }

    setUploadingImages(true);
    try {
      // Secuencial para conservar el orden de selección
      for (const file of toUpload) {
        const url = await uploadToCloudinary(file, 'image');
        addCustomImage(url);
      }
    } catch {
      showMessage('error', 'Error al subir una imagen a Cloudinary');
    } finally {
      setUploadingImages(false);
    }
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

    const networksToUse = isCarousel
      ? selectedNetworks.filter(n => n !== 'linkedin')
      : selectedNetworks;

    if (networksToUse.length === 0) {
      showMessage('error', isCarousel
        ? 'El carrusel se publica solo en FB + IG — activá esa red'
        : 'Selecciona al menos una red social');
      return;
    }

    setIsPublishing(true);
    try {
      const result = await makeService.publishCustom(postText, networksToUse, customImages, useAI, aiProvider);

      if (result.success) {
        showMessage('success', useAI ? '¡Contenido enviado a AI para generar y publicar!' : '¡Publicación enviada correctamente!');
        setPostText('');
        setCustomImages([]);
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
      showMessage('success', '⏳ Subiendo video...');
      const videoUrl = await uploadToCloudinary(videoFile, 'video');

      const result = await makeService.publishCustomReel({
        caption: postText,
        videoUrl: videoUrl,
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
    } catch (error) {
      showMessage('error', 'Error al subir video');
    } finally {
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
    { id: 'statistics', label: 'Stats', fullLabel: 'Estadísticas', icon: '📊' },
    { id: 'proyectos', label: 'Proyectos', fullLabel: 'Mis Proyectos', icon: '🌐' }
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

  const fmtARS = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);

  // Trae el precio real desde los planes centralizados (Admin > Planes) — nunca un
  // número pegado a mano que se desactualiza cuando cambiás precios.
  const TOOL_IMAGES = {
    leadfinder: 'https://res.cloudinary.com/dlshym1te/image/upload/v1788138716/social/leadfinder-promo.png',
    analitica: 'https://res.cloudinary.com/dlshym1te/image/upload/v1788138719/social/analitica-promo.png',
  };

  const buildToolTemplate = async (tool) => {
    if (tool === 'leadfinder') {
      const res = await fetch('/api/leadfinder-plans');
      const data = await res.json().catch(() => ({}));
      const cheapest = (data.plans || []).filter(p => p.priceARS > 0).sort((a, b) => a.priceARS - b.priceARS)[0];
      const priceLine = cheapest ? `Desde ${fmtARS(cheapest.priceARS)}${cheapest.billingType === 'subscription' ? '/mes' : ''}.` : '';
      return `🎯 ¿Sabés cuántos negocios de tu zona todavía no tienen sitio web?

Lead Finder Pro audita negocios locales por localidad, provincia o todo el país: te muestra si tienen web o no, su score SEO, teléfono, horarios y rating — todo en un mapa.

${priceLine} Probalo gratis con una auditoría real:
https://marianoaliandri.com.ar/lead-finder-pro

#LeadFinderPro #SEO #NegociosLocales #MarketingDigital`;
    }
    if (tool === 'analitica') {
      const res = await fetch('/api/analitica-plans');
      const data = await res.json().catch(() => ({}));
      const basico = (data.plans || []).find(p => p.id === 'basico');
      const priceLine = basico ? `Desde ${fmtARS(basico.price)}/mes.` : '';
      return `📊 ¿Qué buscan realmente tus clientes en Google?

Analítica Regional te muestra qué rubros y servicios tienen más demanda de búsqueda en tu zona, con las frases exactas que usa la gente.

${priceLine} Mirá las tendencias gratis, sin registrarte:
https://marianoaliandri.com.ar/analitica

#AnaliticaRegional #SEO #Tendencias #MarketingDigital`;
    }
    return '';
  };

  const useTemplate = async (template) => {
    if (template === 'leadfinder' || template === 'analitica') {
      showMessage('info', 'Trayendo precio actual...');
      const text = await buildToolTemplate(template);
      setPostText(text);
      setUseAI(true); // el texto es un brief para que la IA arme el post final con hashtags
      setCustomImageUrl(TOOL_IMAGES[template] || '');
      return;
    }
    setPostText(templates[template]);
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header - RESPONSIVE */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Redes sociales
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Publica via Make.com
          </p>
        </div>
        <button
          onClick={testConnection}
          disabled={isPublishing}
          className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm"
        >
          Test de conexión
        </button>
      </div>

      {/* Message Alert */}
      {message.text && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`p-3 sm:p-4 rounded-xl text-sm ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Tabs — solo visibles cuando no viene controlado desde AdminPage */}
      <div className={`flex gap-1 sm:gap-2 border-b border-gray-200 dark:border-neutral-800 overflow-x-auto ${initialTab !== null ? 'hidden' : ''}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap -mb-px ${
              activeTab === tab.id
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span className="hidden sm:inline">{tab.fullLabel}</span><span className="sm:hidden">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* AI Provider Selector - RESPONSIVE */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Motor AI
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
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Groq
            </button>
            <button
              onClick={() => setAiProvider('gemini')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                aiProvider === 'gemini'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Gemini
            </button>
          </div>
        </div>
      </div>

      {/* Network Selector - RESPONSIVE */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-4 sm:p-5 rounded-2xl">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
          Redes Sociales
        </h3>
        <div className="flex flex-wrap gap-2">
          {networks.map(network => {
            const blocked = isCarousel && network.id === 'linkedin';
            return (
              <button
                key={network.id}
                onClick={() => toggleNetwork(network.id)}
                disabled={blocked}
                className={`flex-1 sm:flex-none min-w-[100px] px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  selectedNetworks.includes(network.id) && !blocked
                    ? `${network.color} text-white`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title={blocked ? 'LinkedIn no soporta carrusel' : (network.info || network.name)}
              >
                {network.name}
              </button>
            );
          })}
        </div>
        {isCarousel && (
          <div className="mt-3 p-2 sm:p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400">
              <strong>Carrusel:</strong> LinkedIn no soporta carrusel, se excluye. Se publica solo en FB + IG.
            </p>
          </div>
        )}
        {selectedNetworks.includes('facebook') && (
          <div className="mt-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400">
              <strong>FB + IG:</strong> Post en ambas redes automáticamente
            </p>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          {/* Tipo de contenido: Post o Reel */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Tipo de contenido
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
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Post
                </button>
                <button
                  onClick={() => { setContentType('reel'); setCustomImages([]); }}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    contentType === 'reel'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Reel
                </button>
              </div>
            </div>
          </div>

          {/* Templates - RESPONSIVE (solo para posts) */}
          {contentType === 'post' && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Templates
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => useTemplate('service')}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                Servicio
              </button>
              <button
                onClick={() => useTemplate('tip')}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                Tip
              </button>
              <button
                onClick={() => useTemplate('achievement')}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                Logro
              </button>
              <button
                onClick={() => useTemplate('leadfinder')}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                Lead Finder Pro
              </button>
              <button
                onClick={() => useTemplate('analitica')}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                Analítica Regional
              </button>
            </div>
          </div>
          )}

          {/* AI Toggle - RESPONSIVE */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Modo AI
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {isCarousel ? 'Carrusel: se publica tal cual (sin AI)' : (useAI ? 'AI genera el post' : 'Publica tal cual')}
                </p>
              </div>
              <button
                onClick={() => setUseAI(!useAI)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                  useAI ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
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
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              {useAI ? 'Descripción (AI genera contenido)' : 'Texto del Post'}
            </label>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={useAI ? 3 : 6}
              placeholder={useAI
                ? 'Ej: "Nuevo servicio de consultoría en Power BI"'
                : 'Escribe tu publicación aquí...'}
              className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {postText.length} caracteres
            </div>
          </div>

          {/* Imagen (opcional) - Solo para Posts */}
          {contentType === 'post' && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Imágenes (opcional) — {customImages.length}/{MAX_CAROUSEL_IMAGES}
              {isCarousel && <span className="ml-2 normal-case tracking-normal text-indigo-600 dark:text-indigo-400">modo carrusel</span>}
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingImages || customImages.length >= MAX_CAROUSEL_IMAGES}
                onChange={handleMultiFileUpload}
                className="w-full text-xs sm:text-sm text-gray-500 dark:text-gray-400 file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-500/10 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-500/20 disabled:opacity-50"
              />
              <div
                onPaste={(e) => handlePaste(e, addCustomImage)}
                tabIndex={0}
                className="p-3 border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-xl text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40"
              >
                {uploadingImages ? 'Subiendo imágenes...' : 'Pegá una imagen (Ctrl+V) — cada pegado suma una'}
              </div>
              {customImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {customImages.map((url, i) => (
                    <div key={url} className="relative">
                      <img
                        src={url}
                        alt={`Imagen ${i + 1}`}
                        className="w-full aspect-[4/5] object-cover rounded-lg"
                      />
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 rounded">{i + 1}</span>
                      <button
                        onClick={() => removeCustomImage(i)}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors text-[10px]"
                        aria-label={`Quitar imagen ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Video - Solo para Reels */}
          {contentType === 'reel' && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Video del reel
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="w-full text-xs sm:text-sm text-gray-500 dark:text-gray-400 file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-500/10 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-500/20"
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
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            } text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPublishing
              ? 'Procesando...'
              : useAI
                ? 'Generar y publicar'
                : 'Publicar'}
          </button>
          ) : (
          <button
            onClick={handlePublishCustomReel}
            disabled={isPublishing || !postText.trim() || !videoFile}
            className="w-full py-3 text-sm sm:text-base bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing
              ? 'Subiendo reel...'
              : 'Publicar reel'}
          </button>
          )}
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Seleccionar Producto
            </label>
            <select
              value={selectedProduct?.id || ''}
              onChange={(e) => {
                const product = products.find(p => p.id === e.target.value);
                setSelectedProduct(product);
              }}
              className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
            <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-neutral-800 p-4 rounded-xl">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
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
              {isPublishing ? 'Publicando...' : 'Publicar post'}
            </button>
            <button
              onClick={handlePublishReel}
              disabled={isPublishing || !selectedProduct}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isPublishing ? 'Generando...' : 'Crear reel'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="space-y-4">
          {/* Estadísticas en tiempo real de Firebase */}
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
              Estadísticas en tiempo real
              {loadingStats && <span className="animate-pulse text-xs text-indigo-500 normal-case tracking-normal">Cargando...</span>}
              {statsError && <span className="text-xs text-red-600 dark:text-red-400 normal-case tracking-normal">Error al cargar</span>}
            </h3>

            {!loadingStats && !firebaseStats && !statsError && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                No hay datos de estadísticas disponibles todavía.
              </div>
            )}

            {firebaseStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl text-center">
                  <div className="text-3xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
                    {firebaseStats.totalVisits?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Visitas Totales</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl text-center">
                  <div className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    {firebaseStats.uniqueVisitors?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Visitantes Únicos</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl text-center">
                  <div className="text-3xl font-extrabold tracking-tight text-green-600 dark:text-green-400">
                    {firebaseStats.registeredUsers?.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Usuarios Registrados</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl text-center">
                  <div className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    {firebaseStats.likes || 0} / {firebaseStats.dislikes || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Likes / Dislikes</div>
                </div>
              </div>
            )}

            {/* Páginas más visitadas */}
            {firebaseStats && (
              <div className="mb-4">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Páginas más visitadas</h4>
                {firebaseStats.topPages?.length > 0 ? (
                  <div className="space-y-1">
                    {firebaseStats.topPages.slice(0, 5).map((page, index) => (
                      <div key={page.id || index} className="flex justify-between items-center text-xs bg-gray-50 dark:bg-gray-800/40 px-3 py-2 rounded-lg">
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
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Productos más visitados</h4>
                {firebaseStats.topProducts?.length > 0 ? (
                  <div className="space-y-1">
                    {firebaseStats.topProducts.slice(0, 5).map((product, index) => (
                      <div key={product.id || index} className="flex justify-between items-center text-xs bg-gray-50 dark:bg-gray-800/40 px-3 py-2 rounded-lg">
                        <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{product.productName || product.name || product.id}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium ml-2">{product.views || product.count || 0}</span>
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
                className="w-full py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Usar estas estadísticas para publicar
              </button>
            )}
          </div>

          {/* Formulario de publicación */}
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Título
              </label>
              <input
                type="text"
                value={stats.title}
                onChange={(e) => setStats({ ...stats, title: e.target.value })}
                placeholder="Ej: 10,000 visitantes"
                className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Descripción
              </label>
              <textarea
                value={stats.description}
                onChange={(e) => setStats({ ...stats, description: e.target.value })}
                rows={3}
                placeholder="Descripción..."
                className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Métricas (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Visitantes: 10,000 (Enter para agregar)"
                className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-2"
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
                <div className="bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl">
                  {Object.entries(stats.metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-xs sm:text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{key}: {value}</span>
                      <button
                        onClick={() => {
                          const newMetrics = { ...stats.metrics };
                          delete newMetrics[key];
                          setStats({ ...stats, metrics: newMetrics });
                        }}
                        className="text-gray-400 hover:text-red-600 ml-2"
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
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Imagen (opcional)
              </label>
              {stats.imageUrl ? (
                <div className="relative w-full max-w-xs mx-auto aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-700">
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
                  className="p-4 border-2 border-dashed border-indigo-300 dark:border-indigo-500/40 rounded-xl text-center text-xs sm:text-sm text-gray-600 dark:text-gray-300 bg-indigo-50 dark:bg-indigo-500/10 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                >
                  Pegá tu imagen acá (Ctrl+V)
                </div>
              )}
            </div>

            <button
              onClick={handlePublishStatistic}
              disabled={isPublishing || !stats.title || !stats.description}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isPublishing ? 'Publicando...' : 'Publicar estadística'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'proyectos' && (
        <div className="space-y-4">
          {/* Header + botón publicar todos */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cada proyecto se publica con su screenshot, descripción y stats de GSC.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadProyectos}
                disabled={loadingProyectos}
                className="px-3 py-2 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs disabled:opacity-50"
              >
                {loadingProyectos ? 'Recargando...' : 'Recargar'}
              </button>
              <button
                onClick={handlePublishAllProyectos}
                disabled={isPublishing || loadingProyectos || proyectos.length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isPublishing ? 'Publicando...' : `Publicar todos (${proyectos.length})`}
              </button>
            </div>
          </div>

          {/* Loading skeleton */}
          {loadingProyectos && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden animate-pulse">
                  <div className="h-36 bg-gray-200 dark:bg-gray-700" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid de proyectos */}
          {!loadingProyectos && proyectos.length === 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
              No hay proyectos cargados. Revisá que tengas proyectos visibles en el panel Proyectos.
            </p>
          )}

          {!loadingProyectos && proyectos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {proyectos.map(proyecto => {
                const isPublishingThis = publishingProyectoId === proyecto.domain;
                return (
                  <div
                    key={proyecto.domain}
                    className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900"
                  >
                    {/* Screenshot */}
                    <div className="h-36 bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                      <img
                        src={proyecto.screenshotUrl}
                        alt={proyecto.domain}
                        className="w-full h-full object-cover object-top"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      {/* Badge GSC stats */}
                      <div className="absolute bottom-2 left-2 flex gap-1.5">
                        <span className="bg-indigo-600/90 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold">
                          {proyecto.clicks >= 1000 ? `${(proyecto.clicks/1000).toFixed(1)}k` : proyecto.clicks} clicks
                        </span>
                        <span className="bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold">
                          {proyecto.impressions >= 1000 ? `${(proyecto.impressions/1000).toFixed(1)}k` : proyecto.impressions} imp.
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                          {proyecto.domain}
                        </h4>
                        <a
                          href={proyecto.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-700 text-xs flex-shrink-0"
                        >
                          ↗ Ver
                        </a>
                      </div>

                      {proyecto.descripcionCorta && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {proyecto.descripcionCorta}
                        </p>
                      )}

                      {proyecto.stack && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate">
                          {proyecto.stack}
                        </p>
                      )}

                      {!proyecto.descripcionCorta && !proyecto.stack && (
                        <p className="text-xs text-gray-400 dark:text-gray-600 italic">Sin descripción</p>
                      )}

                      <button
                        onClick={() => handlePublishProyecto(proyecto)}
                        disabled={isPublishing || isPublishingThis || publishingProyectoId !== null}
                        className="w-full mt-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPublishingThis ? 'Publicando...' : 'Publicar este proyecto'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
