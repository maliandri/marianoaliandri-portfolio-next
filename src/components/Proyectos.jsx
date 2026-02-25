'use client';

import React from 'react';
import { motion } from 'framer-motion';

// Componente para la sección de proyectos
function Proyectos() {
  const proyectos = [
    {
      id: 1,
      title: 'Web Scrapper para Sitio Mercado Libre',
      description: 'Hosteo de un web scrapper en python de Mercado Libre. Próximamente, alojaré el servicio en esta web.',
      technologies: ['Python', 'Web Scraping'],
    },
    {
      id: 2,
      title: 'Análisis de Datos con Power Bi - Excel',
      description: 'Un proyecto de análisis de datos para generar informes y visualizaciones a partir de grandes conjuntos de datos.',
      technologies: ['Power BI', 'Excel'],
    }
  ];
  return (
    <motion.section
      id="proyectos"
      className="p-8 md:p-12 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-50">
        Mis proyectos
      </h2>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {proyectos.map((proyecto, index) => (
          <motion.div
            key={proyecto.id}
            className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-700 shadow-md hover:shadow-xl transition-all duration-300"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 flex-1">
                {proyecto.title}
              </h3>
            </div>

            <p className="mt-2 text-gray-600 dark:text-gray-300 mb-4">
              {proyecto.description}
            </p>

            {/* Technologies */}
            {proyecto.technologies && proyecto.technologies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {proyecto.technologies.map((tech, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

// Hace que el componente esté disponible para otros archivos
export default Proyectos;
