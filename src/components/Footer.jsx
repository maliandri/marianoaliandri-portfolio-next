'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Footer() {
  const router = useRouter();
  const pathname = usePathname();

  const quickLinks = [
    { name: 'Portfolio', href: '/#proyectos', type: 'scroll' },
    { name: 'Servicios', href: '/#servicios', type: 'scroll' },
    { name: 'Presupuesto', href: '/presupuesto', type: 'route' },
    { name: 'Contacto', href: '/#contact', type: 'scroll' },
  ];

  // Enlaces crawleables a las herramientas (evita páginas huérfanas para SEO)
  const tools = [
    { name: 'Analizador de CV (ATS)', href: '/ats' },
    { name: 'Calculadora de ROI', href: '/roi' },
    { name: 'Cotizador Web', href: '/web' },
    { name: 'Radar KPI', href: '/kpi' },
    { name: 'Radar Web', href: '/radarweb' },
    { name: 'Estadísticas', href: '/stats' },
    { name: 'Auditorías Web', href: '/auditorias' },
  ];


  const certifications = [
    {
      name: 'Mercado Pago Certified',
      logo: (
        <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="48" fill="#009EE3"/>
          <text x="50" y="58" fontSize="28" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">mp</text>
        </svg>
      ),
      color: 'text-[#009EE3]'
    },
    {
      name: 'React Developer',
      logo: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z"/>
        </svg>
      ),
      color: 'text-[#61DAFB]'
    },
    {
      name: 'TypeScript Expert',
      logo: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>
        </svg>
      ),
      color: 'text-[#3178C6]'
    },
  ];

  const handleScrollTo = (href) => {
    // Extraer el hash del href (ej: "/#contact" -> "contact")
    const hash = href.includes('#') ? href.split('#')[1] : '';

    // Si no estamos en la página principal, navegar primero
    if (pathname !== '/') {
      // Navegar a home con el hash
      router.push(`/#${hash}`);
      // El FloatingActions detectará el hash automáticamente
    } else {
      // Ya estamos en home, actualizar el hash directamente
      window.location.hash = hash;

      // Para secciones normales (no calculadoras), hacer scroll
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  return (
    <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 transition-colors duration-500 mt-20">
      <div className="max-w-[1100px] mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Sección Acerca de */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Mariano Aliandri
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Desarrollador Full Stack y Analista de Datos especializado en React, Python y soluciones empresariales.
            </p>
          </div>

          {/* Herramientas (links crawleables para SEO) */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Herramientas
            </h3>
            <ul className="space-y-2">
              {tools.map((tool) => (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Accesos Rápidos */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Accesos Rápidos
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  {link.type === 'route' ? (
                    <Link
                      href={link.href}
                      className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleScrollTo(link.href)}
                      className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm text-left"
                    >
                      {link.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Contacto
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>📧 yo@marianoaliandri.com.ar</p>
              <p>📱 +54 299 541-4422</p>
              <p>📍 Argentina</p>
            </div>
          </div>
        </div>

        {/* Certificaciones */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mb-8">
          <h3 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-6">
            Certificaciones
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {certifications.map((cert) => (
              <div
                key={cert.name}
                className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105"
                title={cert.name}
              >
                <div className={`${cert.color}`}>
                  {cert.logo}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {cert.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Marian Bot */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mb-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Marian Bot
              </h3>
            </div>

            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              Tu asistente virtual inteligente disponible 24/7
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Características */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Inteligencia Artificial
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Powered by Google Gemini para respuestas precisas y contextuales
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Disponible 24/7
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Respuestas instantáneas en cualquier momento del día
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Respuestas Rápidas
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Acceso directo a servicios, precios y contacto
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Conocimiento Experto
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Especializado en análisis de datos, Power BI y Python
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                ¿Tienes preguntas sobre servicios, precios o quieres agendar una reunión?
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Haz clic en el icono de chat en la esquina inferior derecha para hablar con Marian Bot
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} Mariano Aliandri. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            <a
              href="/privacy-policy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline"
            >
              Política de Privacidad
            </a>
            {' · '}
            <a
              href="mailto:yo@marianoaliandri.com.ar"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline"
            >
              Contacto
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
