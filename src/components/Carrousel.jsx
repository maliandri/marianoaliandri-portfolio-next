'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloudinary } from '@cloudinary/url-gen';
import { AdvancedImage } from '@cloudinary/react';
import { CLOUDINARY_CLOUD_NAME } from '../utils/constants';

const cld = new Cloudinary({
  cloud: {
    cloudName: CLOUDINARY_CLOUD_NAME
  }
});

const projectModules = [
  {
    name: 'Chatbot Ventas Almamod.com.ar',
    title: 'Chatbot Que genera ventas y leads en almamod.com.ar',
    slides: [
      { 
        publicId: 'chat1', 
        text: 'El asistente inicia la interacción con un saludo empático, detectando visitas previas para personalizar la experiencia desde el primer segundo.' 
      },
      { 
        publicId: 'chat2', 
        text: 'A través de preguntas clave, el bot perfila al cliente identificando si busca vivienda o inversión y cuáles son sus prioridades.' 
      },
      { 
        publicId: 'chat3', 
        text: 'Basado en las respuestas anteriores, presenta los modelos (Alma 36 / Refugio) y precios que mejor se ajustan a la necesidad detectada.' 
      },
      { 
        publicId: 'chat4', 
        text: 'Refuerza la propuesta destacando beneficios técnicos (ahorro energético, rapidez de entrega) y prepara el terreno para el cierre.' 
      },
      { 
        publicId: 'chat5', 
        text: 'Estrategia de "Lead Magnet" exitosa, capturando WhatsApp y Email a cambio de la ficha técnica para continuar el seguimiento comercial.' 
      }
    ]
  },
  {
    name: 'Piel de Almamod.com.ar',
    title: 'Cambio de imagen con Theme Toogle',
    slides: [
      { publicId: 'homelight1', text: 'Tema claro / Celeste' },
      { publicId: 'homedark', text: 'Tema Oscuro ' },
    ]
  },
{
    name: 'Certificaciones de Almamod.com.ar',
    title: 'Certificaciones de la empresa expresado en datos',
    slides: [
      { publicId: 'cat', text: 'Certificacion de Aptitud Tecnica' },
      { publicId: 'cat2', text: 'Modulo para explicar la importancia de dicha certificacion ' },
      { publicId: 'cas', text: 'CCertificado de Aptitud Sismorresistente (CAS)' },
      { publicId: 'cas2', text: 'Modulo para explicar la importancia de dicha certificacion ' },
      { publicId: 'edge', text: 'EDGE Advanced Certified' },
      { publicId: 'edge2', text: 'Modulo para explicar la importancia de dicha certificacion ' },
      { publicId: 'cacmi', text: 'Certificación CACMI' },
      { publicId: 'cacmi2', text: 'Modulo para explicar la importancia de dicha certificacion ' },
    ]
  },
{
    name: 'Sistema Constructivo de Almamod.com.ar ',
    title: 'Explicacion del Sistema Constructivo de Propanel',
    slides: [
      { publicId: 'sistemaconstructivo', text: 'Datos del Sistema Constructivo de Propanel' },
      { publicId: 'sistemaconstructivo1', text: '5 Razones fundamentadas para construir con Propanel ' },
    ]
  },

  {
    name: 'Tienda de Almamod.com.ar ',
    title: 'Tienda de Modulos que fabrica Almamod',
    slides: [
      { publicId: 'Tienda', text: 'Tienda de Modulos que fabrica Almamod' },
      { publicId: 'cartadeproducto', text: 'Carta de producto personalizada con boton de contacto de whatsapp personalizado' },
    ]
  },
   {
    name: 'Carrete de Obras Almamod.com.ar ',
    title: 'carrete de imagenes de Obras',
    slides: [
      { publicId: 'carreteobras1', text: 'Menu general para inspeccionar las obras de la empresa' },
      { publicId: 'carreteobras2', text: 'Carrete de cada obra personalizado con texto identificativo' },
    ]
  },
];

const Carrousel = () => {
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const currentModule = projectModules[currentModuleIndex];
  const imageData = currentModule.slides;

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(true);
  }, [currentModuleIndex]);

  useEffect(() => {
    if (isPlaying) {
      const intervalId = setInterval(() => {
        setCurrentIndex(prevIndex => (prevIndex + 1) % imageData.length);
      }, 10000);

      return () => clearInterval(intervalId);
    }
  }, [isPlaying, imageData.length]);

  const nextSlide = () => {
    setIsPlaying(false);
    setCurrentIndex(prevIndex => (prevIndex + 1) % imageData.length);
  };

  const prevSlide = () => {
    setIsPlaying(false);
    setCurrentIndex(prevIndex => (prevIndex - 1 + imageData.length) % imageData.length);
  };

  const changeModule = (newIndex) => {
    setCurrentModuleIndex(newIndex);
  };

  return (
    <motion.section
      className="p-8 md:p-12 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="flex justify-center items-center mb-4 space-x-2">
        {projectModules.map((module, index) => (
          <button
            key={module.title}
            onClick={() => changeModule(index)}
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-colors ${
              currentModuleIndex === index
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-700 bg-gray-200 hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500'
            }`}
          >
            {module.name}
          </button>
        ))}
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-50 mb-2 h-20 flex items-center justify-center">
        {currentModule.title}
      </h2>
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-[540px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
        <AnimatePresence mode="wait">
          {imageData.length > 0 && (
            <motion.div
              key={`${currentModuleIndex}-${currentIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8 }}
              className="w-full h-full p-4"
            >
              <div className="w-full h-full flex items-center justify-center relative">
                {/* Contenedor con efecto de sombra interna suave */}
                <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner">
                  {/* Borde difuso superior */}
                  <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/30 via-transparent to-transparent dark:from-black/30 pointer-events-none z-10"></div>

                  {/* Borde difuso inferior */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/30 via-transparent to-transparent dark:from-black/30 pointer-events-none z-10"></div>

                  {/* Borde difuso izquierdo */}
                  <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-white/30 via-transparent to-transparent dark:from-black/30 pointer-events-none z-10"></div>

                  {/* Borde difuso derecho */}
                  <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-white/30 via-transparent to-transparent dark:from-black/30 pointer-events-none z-10"></div>

                  {/* Imagen */}
                  <AdvancedImage
                    cldImg={cld.image(imageData[currentIndex].publicId)}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Texto descriptivo con mejor diseño */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-gradient-to-r from-black/80 via-black/70 to-black/80 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-xl">
                  <p className="text-center text-sm md:text-base text-white font-medium leading-relaxed">
                    {imageData[currentIndex].text}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex justify-center items-center mt-4 space-x-4">
        <button
          onClick={prevSlide}
          className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          aria-label="Previous Slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" /></svg>
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          aria-label={isPlaying ? "Pause Slideshow" : "Play Slideshow"}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75zM16.5 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0V6a.75.75 0 01.75-.75z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        <button
          onClick={nextSlide}
          className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          aria-label="Next Slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" /></svg>
        </button>
      </div>
    </motion.section>
  );
};

export default Carrousel;
