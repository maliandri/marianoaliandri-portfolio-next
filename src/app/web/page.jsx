export const metadata = {
  title: 'Cotizador de Sitios Web | Mariano Aliandri',
  description: 'Obtené un presupuesto instantáneo para tu sitio web. Elegí las funcionalidades que necesitás y conocé el precio al instante.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/web/' },
};

// El modal de esta herramienta se renderiza en providers.jsx según el pathname.
// Esta página debe quedar vacía para no interferir con el modal.
export default function ToolPage() {
  return <h1 className="sr-only">Cotizador de Sitios Web — Mariano Aliandri</h1>;
}
