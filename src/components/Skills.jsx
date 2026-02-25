'use client';

import React from 'react';
import { motion } from 'framer-motion';

// Defines el componente para la sección de habilidades
function Skills() {
  const skills = [
    "CIENCIA DE DATOS",
    "EXCEL",
    "MACROS EN EXCEL",
    "POWER PIVOT",
    "POWER QUERY",
    "POWER BI",
    "PYTHON",
    "WEB DEVELOPMENT",
    "HTML5",
    "CSS3",
    "JavaScript (ES6+)",
    "React",
    "Node.js",
    "Git & GitHub",
  ];

  return (
    <motion.section
      id="skills"
      className="p-8 md:p-12 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      aria-labelledby="skills-heading"
    >
      <h2 id="skills-heading" className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-50">
        Mis Habilidades
      </h2>

      <ul className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" role="list" aria-label="Lista de habilidades técnicas">
        {skills.map((skill, index) => (
          <motion.li
            key={index}
            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-md text-center font-medium text-gray-700 dark:text-gray-200 transform hover:scale-105 transition-all duration-300"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            {skill}
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
}

// Exporta el componente para que pueda ser importado y usado en otros archivos
export default Skills;
