export const metadata = {
  title: 'Demo — Lead Finder Pro',
  description: 'Prueba gratuita de Lead Finder Pro: mirá una auditoría real completa, registrate para acceder.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/lead-finder-pro/demo/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/demo/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/demo/',
    },
  },
  // Contenido gateado detrás de login y datos reutilizados de /auditorias/[id] —
  // no debe competir por ranking con las páginas públicas de auditorías.
  robots: { index: false, follow: true },
};

export default function LeadFinderProDemoLayout({ children }) {
  return children;
}
