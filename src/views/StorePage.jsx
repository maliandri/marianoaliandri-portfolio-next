'use client';
import React from 'react';
import Store from '../components/Store';
import SEO from '../components/SEO';

export default function StorePage() {
  return (
    <>
      <SEO
        title="Tienda | Mariano Aliandri - Servicios de Desarrollo Web y Data"
        description="Explorá los servicios de desarrollo web, e-commerce, landing pages, dashboards Power BI y más. Soluciones tecnológicas a medida para tu negocio."
        canonical="/tienda"
      />
      <Store isOpen={true} onClose={() => window.history.back()} />
    </>
  );
}
