'use client';

// src/components/ServiciosCarousel.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function ServiciosCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const servicios = [
    {
      id: 1,
      titulo: "Análisis de Datos con Power BI",
      descripcion: "Transformo tus datos en insights accionables con dashboards interactivos y reportes automatizados que impulsan la toma de decisiones estratégicas.",
      icon: "📊",
      color: "from-blue-500 to-indigo-600",
      features: ["Dashboards Interactivos", "KPIs Personalizados", "Automatización de Reportes", "Integración de Fuentes"],
      // precio: "$1.200"
    },
    {
      id: 2,
      titulo: "Excel Avanzado & Automatización",
      descripcion: "Optimizo tus procesos con macros, Power Query y Power Pivot. Convierte hojas de cálculo en herramientas poderosas de análisis.",
      icon: "📈",
      color: "from-green-500 to-emerald-600",
      features: ["Macros Avanzadas", "Power Query ETL", "Power Pivot", "Dashboards Dinámicos"],
      // precio: "$600"
    },
    {
      id: 3,
      titulo: "Web Scraping & Python",
      descripcion: "Automatizo la recolección de datos de sitios web como Mercado Libre, competidores, precios y más. Datos actualizados en tiempo real.",
      icon: "🐍",
      color: "from-purple-500 to-violet-600",
      features: ["Web Scraping", "APIs Personalizadas", "Automatización", "Análisis Estadístico"],
      // precio: "$900"
    },
    {
      id: 4,
      titulo: "Desarrollo Web Completo",
      descripcion: "Creo sitios web modernos y responsivos que convierten visitantes en clientes. Desde landing pages hasta e-commerce completos.",
      icon: "🌐",
      color: "from-orange-500 to-red-600",
      features: ["Sitios Responsivos", "E-commerce", "SEO Optimizado", "Análisis de Conversión"],
      // precio: "Desde $1.500"
    },
    {
      id: 5,
      titulo: "Consultoría en Inteligencia Empresarial",
      descripcion: "Audito y diseño estrategias completas de BI. Desde la arquitectura de datos hasta la implementación de KPIs que realmente importen.",
      icon: "🎯",
      color: "from-teal-500 to-cyan-600",
      features: ["Auditoría de Procesos", "Arquitectura de Datos", "KPIs Estratégicos", "Roadmap de BI"],
      // precio: "A convenir"
    },
    {
      id: 6,
      titulo: "Capacitación & Mentoring",
      descripcion: "Entreno a tu equipo en herramientas de análisis de datos. Workshops personalizados para maximizar el ROI de tus inversiones en BI.",
      icon: "🎓",
      color: "from-pink-500 to-rose-600",
      features: ["Workshops Personalizados", "Power BI Training", "Excel Avanzado", "Mentoring 1:1"],
      // precio: "$300"
    }
  ];

  // Auto-play del carrusel
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === servicios.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, servicios.length]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    // Reactivar auto-play después de 10 segundos
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? servicios.length - 1 : currentIndex - 1);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex === servicios.length - 1 ? 0 : currentIndex + 1);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const currentService = servicios[currentIndex];

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection) => {
    setPage([page + newDirection, newDirection]);
    if (newDirection === 1) {
      goToNext();
    } else {
      goToPrevious();
    }
  };

  return (
    <motion.section
      id="servicios"
      className="p-8 md:p-12 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50">
          Mis Servicios
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Soluciones completas de análisis de datos e inteligencia empresarial
        </p>
      </div>

      {/* Carrusel Principal */}
      <div className="relative h-96 md:h-80 mb-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0"
          >
            <div className={`h-full bg-gradient-to-br ${currentService.color} rounded-2xl p-6 md:p-8 text-white relative overflow-hidden`}>
              {/* Decoración de fondo (no interactiva) */}
              <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="pointer-events-none absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full translate-y-12 -translate-x-12"></div>

              <div className="relative z-10 h-full flex flex-col">
                {/* Header del servicio */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="text-4xl">{currentService.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-2xl md:text-3xl font-bold mb-2">
                      {currentService.titulo}
                    </h3>
                    <p className="text-lg opacity-90">
                      {currentService.descripcion}
                    </p>
                  </div>
                  {/* Precio opcional: solo se muestra si existe */}
                  {currentService.precio && (
                    <div className="text-right">
                      <div className="text-sm opacity-75">Desde</div>
                      <div className="text-xl font-bold">{currentService.precio}</div>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-3">Incluye:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {currentService.features.map((feature, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center gap-2 text-sm"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                      >
                        <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {feature}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="flex gap-3 mt-6">
                  <motion.button
                    onClick={() =>
                      window.open(
                        `https://wa.me/+542995414422?text=${encodeURIComponent(
                          `Hola! Me interesa el servicio de ${currentService.titulo}. ¿Podemos agendar una consulta?`
                        )}`,
                        '_blank'
                      )
                    }
                    className="bg-white text-gray-900 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Consultar 💬
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      // Lugar para abrir una calculadora o ampliar info
                      console.log("Más información sobre", currentService.titulo);
                    }}
                    className="bg-transparent border-2 border-white text-white px-6 py-2 rounded-lg font-semibold hover:bg-white hover:text-gray-900 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Ver Más
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Botones de navegación (reposicionados hacia los bordes) */}
        <button
          onClick={() => paginate(-1)}
          aria-label="Anterior"
          className="absolute -left-10 md:-left-14 top-1/2 -translate-y-1/2 z-10 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => paginate(1)}
          aria-label="Siguiente"
          className="absolute -right-10 md:-right-14 top-1/2 -translate-y-1/2 z-10 p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Indicadores de puntos */}
      <div className="flex justify-center gap-2 mb-6">
        {servicios.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'bg-indigo-600 scale-125'
                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
            }`}
            aria-label={`Ir al slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Miniaturas de servicios */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {servicios.map((servicio, index) => (
          <motion.button
            key={servicio.id}
            onClick={() => goToSlide(index)}
            className={`p-3 rounded-xl border-2 transition-all duration-300 text-center ${
              index === currentIndex
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            aria-label={`Seleccionar ${servicio.titulo}`}
          >
            <div className="text-2xl mb-1">{servicio.icon}</div>
            <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
              {servicio.titulo.split(' ')[0]}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Indicador de auto-play */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          {isAutoPlaying ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Auto-play activo
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Auto-play pausado
            </>
          )}
        </button>
      </div>
    </motion.section>
  );
}

export default ServiciosCarousel;
