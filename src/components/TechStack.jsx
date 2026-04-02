'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  {
    id: 'frontend',
    label: '🖥️ Frontend',
    techs: [
      {
        name: 'React',
        color: 'text-[#61DAFB]',
        description: 'Librería para construir interfaces basadas en componentes.',
        usage: 'Base de todos mis proyectos: portfolio, Aluminé Hogar, AlmaMod, Zprest, Kredify, Total Protección y Legado ByD.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z"/>
          </svg>
        ),
      },
      {
        name: 'Next.js',
        color: 'text-gray-900 dark:text-white',
        description: 'Framework full-stack con App Router, SSR y API Routes.',
        usage: 'Usado en portfolio, Legado ByD, Kredify y Zprest. Maneja rutas, SEO, server components y serverless.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.573 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z"/>
          </svg>
        ),
      },
      {
        name: 'TypeScript',
        color: 'text-[#3178C6]',
        description: 'JavaScript con tipado estático para código más robusto.',
        usage: 'Implementado en Legado ByD, Kredify, Zprest y Total Protección para mayor seguridad en producción.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>
          </svg>
        ),
      },
      {
        name: 'Tailwind CSS',
        color: 'text-[#06B6D4]',
        description: 'Framework CSS utility-first para estilos rápidos y consistentes.',
        usage: 'Sistema de estilos en todos los proyectos. Dark mode, responsive y temas personalizados por marca.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C10.337,13.382,8.976,12,6.001,12z"/>
          </svg>
        ),
      },
      {
        name: 'Framer Motion',
        color: 'text-[#BB4B96]',
        description: 'Librería de animaciones declarativas para React.',
        usage: 'Transiciones del portfolio, toggle compra/alquiler en tienda, y chatbot Almita en AlmaMod.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'backend',
    label: '⚙️ Backend',
    techs: [
      {
        name: 'Node.js',
        color: 'text-[#339933]',
        description: 'Entorno JavaScript del lado del servidor.',
        usage: 'Corre las API Routes de todos los proyectos Next.js: pagos, emails, IA, webhooks y más.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0 l8.795-5.076c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072 c-0.081-0.047-0.189-0.047-0.271,0L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235 l2.409,1.392c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253 v10.021c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z"/>
          </svg>
        ),
      },
      {
        name: 'Express',
        color: 'text-gray-900 dark:text-white',
        description: 'Framework minimalista para APIs REST en Node.js.',
        usage: 'Backend de Aluminé Hogar: serverless functions con endpoints de productos, pagos y chatbot.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 18.588a1.529 1.529 0 01-1.895-.72l-3.45-4.771-.5-.667-4.003 5.444a1.466 1.466 0 01-1.802.708l5.158-6.92-4.798-6.251a1.595 1.595 0 011.9.666l3.576 4.83 3.596-4.81a1.435 1.435 0 011.788-.668L21.708 7.9l-2.522 3.283a.666.666 0 000 .994l4.804 6.412zM.002 11.576l.42-2.075c1.154-4.103 5.858-5.81 9.094-3.27 1.895 1.489 2.368 3.597 2.275 5.973H1.116C.943 16.447 4.005 19.009 7.92 17.7a4.078 4.078 0 002.582-2.876c.207-.666.548-.78 1.174-.588a5.417 5.417 0 01-2.589 3.957 6.272 6.272 0 01-7.306-.933 6.575 6.575 0 01-1.64-3.858c0-.235-.08-.455-.134-.666A88.33 88.33 0 010 11.577zm1.127-.286h9.654c-.06-3.076-2.001-5.258-4.59-5.278-2.882-.04-4.944 2.094-5.071 5.264z"/>
          </svg>
        ),
      },
      {
        name: 'Python',
        color: 'text-[#3776AB]',
        description: 'Lenguaje multiparadigma ideal para datos y automatización.',
        usage: 'Scraping competitivo, análisis de datasets, y base del sistema AR de detección YOLOv8 (en desarrollo).',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'database',
    label: '🗃️ Base de Datos',
    techs: [
      {
        name: 'Firebase',
        color: 'text-[#FFCA28]',
        description: 'Plataforma de Google con Firestore, Auth y Analytics en tiempo real.',
        usage: 'Autenticación y base de datos en portfolio, Legado ByD y Kredify. Gestiona productos, pedidos y usuarios.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z"/>
          </svg>
        ),
      },
      {
        name: 'MongoDB',
        color: 'text-[#47A248]',
        description: 'Base de datos NoSQL orientada a documentos, flexible y escalable.',
        usage: 'Backend de Aluminé Hogar: catálogo de colchones, órdenes de compra y usuarios con esquema flexible.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z"/>
          </svg>
        ),
      },
      {
        name: 'Supabase',
        color: 'text-[#3ECF8E]',
        description: 'Alternativa open source a Firebase basada en PostgreSQL.',
        usage: 'Base de datos principal de Zprest (préstamos, cuotas, billeteras) y AlmaMod (leads del chatbot Almita).',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C.272 12.636.68 13.5 1.408 13.5h9.091l.5 9.457c.015.986 1.26 1.41 1.874.637l9.262-11.653c.492-.585.084-1.449-.644-1.449h-9.091l-.5-9.456z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'data',
    label: '📊 Data & BI',
    techs: [
      {
        name: 'Power BI',
        color: 'text-[#F2C811]',
        description: 'Herramienta de Microsoft para dashboards interactivos.',
        usage: 'Dashboards de KPIs y reportes automatizados para clientes empresariales. Servicio activo en la tienda.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.5 2.5h3v19h-3zm5.75 3.5h3v15.5h-3zM4.75 9h3v10.5h-3z"/>
          </svg>
        ),
      },
      {
        name: 'Pandas',
        color: 'text-[#150458]',
        description: 'Librería Python para análisis y manipulación de datos estructurados.',
        usage: 'ETL y limpieza de datasets para análisis previo a visualización en Power BI.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.922 0h2.623v18.104h-2.623zm-4.126 12.94h2.623v2.57h-2.623zm0-7.037h2.623v5.446h-2.623zm0 11.197h2.623v5.446h-2.623zM4.456 5.896h2.622V24H4.456zm4.213 2.559h2.623v2.57H8.67zm0 4.151h2.623v5.447H8.67zm0-11.187h2.623v5.446H8.67Z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'pagos',
    label: '💳 Pagos',
    techs: [
      {
        name: 'MercadoPago',
        color: 'text-[#009EE3]',
        description: 'Plataforma de pagos líder en Latinoamérica.',
        usage: 'Checkout integrado en el portfolio y en Aluminé Hogar. Maneja preferencias de pago y webhooks de notificaciones.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="48" fill="#009EE3"/>
            <text x="50" y="58" fontSize="28" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">mp</text>
          </svg>
        ),
      },
      {
        name: 'BindX',
        color: 'text-[#6C47FF]',
        description: 'Infraestructura fintech argentina para transferencias, DEBIN y CVU.',
        usage: 'En implementación en Zprest: acreditación de préstamos, cobro de cuotas vía DEBIN Spot y CVU único por cliente.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h16v3H4zm0 5h10v3H4zm0 5h16v3H4zm12-5h4v3h-4z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'storage',
    label: '🗄️ Storage',
    techs: [
      {
        name: 'Cloudinary',
        color: 'text-[#3448C5]',
        description: 'CDN de imágenes y video con transformaciones on-the-fly.',
        usage: 'Assets en portfolio, Legado ByD, AlmaMod y Aluminé Hogar. Convierte WebM a MP4/H264 para reels de Instagram.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.5 12.6c0-3.4-2.5-6.2-5.8-6.6C15.7 2.6 12.4 0 8.5 0 4 0 .3 3.7.3 8.2c0 .3 0 .6.1.9C.2 9.4 0 9.8 0 10.2c0 1.5 1.2 2.7 2.7 2.7h17.6c1.2 0 2.2-1 2.2-2.3z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'ia',
    label: '🤖 IA',
    techs: [
      {
        name: 'Google Gemini',
        color: 'text-[#4285F4]',
        description: 'Modelo de lenguaje multimodal de Google (2.5 Flash).',
        usage: 'Chatbot en portfolio, Legado ByD, AlmaMod (Almita), Kredify y Zprest (Ziro). También genera scripts de reels, captions y análisis de CV.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'automatizacion',
    label: '⚡ Automatización',
    techs: [
      {
        name: 'Make.com',
        color: 'text-[#6D00CC]',
        description: 'Plataforma de automatización de flujos sin código.',
        usage: 'Conecta el portfolio con LinkedIn, Instagram y Facebook: recibe webhooks y publica contenido generado por IA automáticamente.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 2a8 8 0 110 16A8 8 0 0112 4zm-1 3v5.586l-3.707 3.707 1.414 1.414L13 14.414V7h-2z"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'deploy',
    label: '🚀 Deploy',
    techs: [
      {
        name: 'Vercel',
        color: 'text-gray-900 dark:text-white',
        description: 'Plataforma de deploy para proyectos Next.js con edge network global.',
        usage: 'Deploy automático de portfolio, Kredify, Zprest y Aluminé Hogar. Gestiona DNS, edge network y variables de entorno.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 22.525H0l12-21.05 12 21.05z"/>
          </svg>
        ),
      },
      {
        name: 'Netlify',
        color: 'text-[#00C7B7]',
        description: 'Plataforma de deploy con CDN global, funciones serverless y CI/CD.',
        usage: 'Deploy de proyectos estáticos y JAMstack. Usado como alternativa a Vercel en proyectos de clientes con hosting incluido.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.934 8.519a1.044 1.044 0 01.303.23l2.349-1.045-2.192-2.171-.46 2.986zM14.802 8.29c.172.061.333.142.482.243l3.235-1.438-1.13-1.12-2.587 2.315zM18.443 10.555c.016.116.026.235.026.356 0 .136-.012.27-.032.4l2.453 1.151v-2.94l-2.447 1.033zM3.667 11.36c0 .053.002.104.006.154l2.388-1.172-2.384-.85a4.108 4.108 0 00-.01.868zM5.527 8.29L2.94 10.604l2.387.85a4.116 4.116 0 01.2-3.164zM16.39 12.893c-.253.345-.574.636-.942.857l.766 3.609 1.634-1.617-1.458-2.849zM12.96 13.9c-.174.03-.352.046-.534.046-.234 0-.463-.023-.686-.068l-1.305 2.67 2.525-2.648zM5.898 9.214l-.684 2.928 1.658-2.2a4.148 4.148 0 01-.974-.728zM13.754 8.183a4.103 4.103 0 01.636.404l2.65-2.37-2.033-.516-.253 2.482zM11.026 8.083l-.271-2.546-2.09.53 2.361 2.016zM9.73 14.662l-1.244-2.6-1.664 2.208 1.654 1.637 1.254-1.245zM8.394 11.367a4.103 4.103 0 01-.088-.807c0-.198.016-.391.047-.58L5.9 8.87l.677 2.899 1.817-.402zM11.53 8.035c.154-.013.31-.02.467-.02.315 0 .624.028.924.082l.252-2.466-1.371-.348-.272 2.752zM14.605 13.585c-.398.22-.84.371-1.31.44l1.306 2.67 1.312-1.3-.308-1.81zM10.47 13.978a4.107 4.107 0 01-1.4-.568l-1.259 1.249 4.214 4.168v-2.2l-1.555-2.649zM15.277 9.27c.268.338.476.726.609 1.147l2.438-1.029-2.001-1.982-1.046.864zM14.943 12.99c-.142.12-.295.228-.456.32l.307 1.811.462-.457-.313-1.674zM11.03 13.996a4.063 4.063 0 01-.516-.148l1.549 2.64V19.6l-1.02-1.009-1.25 1.24 3.432 3.398.7-3.298-2.895-5.935zM15.546 8.666l1.044-.861-3.15-.799-.252 2.459c.91.21 1.703.668 2.358 1.201zM10.518 13.718a4.09 4.09 0 01-.931-.857l-1.826.406 4.286 4.243v-2.129l-1.53-1.663zM19.35 9.977l-2.426 1.023c.025.16.038.324.038.49a4.14 4.14 0 01-.616 2.169l1.456 2.845 1.548-1.531V9.977z"/>
          </svg>
        ),
      },
      {
        name: 'GitHub',
        color: 'text-gray-900 dark:text-white',
        description: 'Plataforma de hosting de código y colaboración con Git.',
        usage: 'Repositorios privados de todos los proyectos. Integrado con Vercel y Netlify para CI/CD automático en cada push a main.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
        ),
      },
      {
        name: 'Git',
        color: 'text-[#F05032]',
        description: 'Sistema de control de versiones distribuido.',
        usage: 'Flujo estándar en todos los proyectos: feature branch → main → auto-deploy en Vercel o Netlify.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L8.708 2.627l2.76 2.76c.645-.215 1.379-.07 1.889.441.516.515.658 1.258.438 1.9l2.658 2.66c.645-.223 1.387-.078 1.9.435.721.72.721 1.884 0 2.604-.719.719-1.881.719-2.6 0-.539-.541-.674-1.337-.404-1.996L12.86 8.955v6.525c.176.086.342.203.488.348.713.721.713 1.883 0 2.6-.719.721-1.889.721-2.609 0-.719-.719-.719-1.879 0-2.598.182-.18.387-.316.605-.406V8.835c-.217-.091-.424-.222-.6-.401-.545-.545-.676-1.342-.396-2.009L7.636 3.7.45 10.881c-.6.605-.6 1.584 0 2.189l10.48 10.477c.604.604 1.582.604 2.186 0l10.43-10.43c.605-.603.605-1.582 0-2.187"/>
          </svg>
        ),
      },
    ],
  },
  {
    id: 'email',
    label: '📧 Email',
    techs: [
      {
        name: 'Resend',
        color: 'text-gray-900 dark:text-white',
        description: 'API moderna para envío de emails transaccionales.',
        usage: 'Notificaciones en Legado ByD, AlmaMod, Zprest y Kredify: confirmaciones, alertas de cobro y captura de leads.',
        icon: (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 4a2 2 0 012-2h16a2 2 0 012 2v.5L12 13 2 4.5V4zm0 2.5V20a2 2 0 002 2h16a2 2 0 002-2V6.5l-10 8.5-10-8.5z"/>
          </svg>
        ),
      },
    ],
  },
];

export default function TechStack() {
  const [selectedTech, setSelectedTech] = useState(null);
  const [openCategories, setOpenCategories] = useState(new Set());

  const toggleCategory = (id) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <motion.section
      id="skills"
      className="p-8 md:p-12 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-gray-50 mb-2">
        Stack Tecnológico
      </h2>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-8">
        Expandí cada categoría para ver las tecnologías
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {CATEGORIES.map((cat) => {
          const isOpen = openCategories.has(cat.id);
          return (
            <div key={cat.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Accordion header */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                    {cat.label}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
                    {cat.techs.length} tecnología{cat.techs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Colored dots preview */}
                  {!isOpen && (
                    <div className="flex items-center gap-1">
                      {cat.techs.slice(0, 5).map((t) => (
                        <span key={t.name} className={t.color} title={t.name}>
                          <span className="block w-2.5 h-2.5 rounded-full bg-current opacity-70" />
                        </span>
                      ))}
                      {cat.techs.length > 5 && (
                        <span className="text-xs text-gray-400 ml-0.5">+{cat.techs.length - 5}</span>
                      )}
                    </div>
                  )}
                  {/* Chevron */}
                  <motion.svg
                    className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </div>
              </button>

              {/* Accordion content */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {cat.techs.map((tech, i) => (
                        <motion.button
                          key={tech.name}
                          onClick={() => setSelectedTech(tech)}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all duration-200 text-left"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <span className={`shrink-0 ${tech.color}`}>{tech.icon}</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
                            {tech.name}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedTech && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTech(null)}
            />
            <motion.div
              className="fixed inset-x-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="flex items-center gap-4 mb-4">
                <span className={`${selectedTech.color}`}>{selectedTech.icon}</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedTech.name}
                </h3>
                <button
                  onClick={() => setSelectedTech(null)}
                  className="ml-auto p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
                  aria-label="Cerrar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                {selectedTech.description}
              </p>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Cómo lo uso
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedTech.usage}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
