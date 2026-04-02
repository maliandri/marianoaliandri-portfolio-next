export const metadata = {
  title: 'Radar KPI — Analizá tu Negocio | Mariano Aliandri',
  description: 'Visualizá los KPIs clave de tu negocio en un radar interactivo. Identificá fortalezas y áreas de mejora con un vistazo.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/kpi/' },
};

// El modal de esta herramienta se renderiza en providers.jsx según el pathname.
// Esta página debe quedar vacía para no interferir con el modal.
export default function ToolPage() {
  return <h1 className="sr-only">Radar KPI — Analizá tu Negocio | Mariano Aliandri</h1>;
}
