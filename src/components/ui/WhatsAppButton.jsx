'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackGAEvent } from '@/utils/firebaseservice';

const WhatsAppButton = () => {
  const [currentSection, setCurrentSection] = useState('Inicio');
  const pathname = usePathname();
  const phoneNumber = '+542995414422';

  // Mapeo de rutas a nombres de página
  const pageNames = {
    '/': 'Página Principal',
    '/perfil': 'Mi Perfil',
    '/mis-compras': 'Mis Compras',
    '/tienda': 'Tienda',
    '/admin': 'Panel Admin',
    '/web': 'Cotizador Web',
    '/roi': 'Calculadora ROI',
    '/stats': 'Estadísticas',
    '/ats': 'Analizador ATS',
    '/kpi': 'Radar KPI',
    '/radarweb': 'Radar Web'
  };

  // Detectar sección visible en scroll (solo para home y herramientas)
  useEffect(() => {
    const isHomePage = pathname === '/' ||
      ['/web', '/roi', '/stats', '/ats', '/kpi', '/radarweb'].includes(pathname);

    if (!isHomePage) {
      // Si no es home, usar el nombre de la página
      setCurrentSection(pageNames[pathname] || 'Sitio Web');
      return;
    }

    const sections = [
      { id: 'hero', name: 'Inicio' },
      { id: 'servicios', name: 'Servicios' },
      { id: 'skills', name: 'Skills' },
      { id: 'carrousel', name: 'Portfolio' },
      { id: 'contact', name: 'Contacto' }
    ];

    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3;

      // Buscar la sección visible
      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i].id) ||
          document.querySelector(`[aria-label*="${sections[i].name}"]`) ||
          document.querySelector(`section:nth-of-type(${i + 1})`);

        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = rect.top + window.scrollY;

          if (scrollPosition >= elementTop) {
            // Si hay una herramienta abierta, agregar esa info
            const toolName = pageNames[pathname];
            if (pathname !== '/' && toolName) {
              setCurrentSection(`${sections[i].name} (${toolName})`);
            } else {
              setCurrentSection(sections[i].name);
            }
            return;
          }
        }
      }

      // Por defecto, mostrar Inicio
      setCurrentSection('Inicio');
    };

    // Ejecutar al montar y en scroll
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  const handleClick = () => {
    trackGAEvent('whatsapp_click', { section: currentSection, page_path: pathname });
    const message = `¡Hola Mariano! 👋 Te escribo desde tu web, sección: *${currentSection}*. Me gustaría consultarte sobre...`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      className="whatsapp-floating-btn"
      aria-label="Contactar por WhatsApp"
      title="Contactar por WhatsApp"
    >
      {/* Icono de WhatsApp */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="whatsapp-icon"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </button>
  );
};

export default WhatsAppButton;
