export const metadata = {
  title: 'Estadísticas del Portfolio | Mariano Aliandri',
  description: 'Dashboard en tiempo real con visitas, clics en Google, likes y datos de Google Search Console del portfolio de Mariano Aliandri.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/stats/' },
};

// El modal de esta herramienta se renderiza en providers.jsx según el pathname.
// Esta página debe quedar vacía para no interferir con el modal.
export default function ToolPage() {
  return <h1 className="sr-only">Estadísticas del Portfolio | Mariano Aliandri</h1>;
}
