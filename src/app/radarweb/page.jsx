export const metadata = {
  title: 'Radar Web — Auditá tu Sitio | Mariano Aliandri',
  description: 'Analizá el estado de tu sitio web: velocidad, SEO, seguridad y rendimiento visualizados en un radar interactivo. Gratis y en segundos.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/radarweb/' },
};

// El modal de esta herramienta se renderiza en providers.jsx según el pathname.
// Esta página debe quedar vacía para no interferir con el modal.
export default function ToolPage() {
  return <h1 className="sr-only">Radar Web — Auditá tu Sitio | Mariano Aliandri</h1>;
}
