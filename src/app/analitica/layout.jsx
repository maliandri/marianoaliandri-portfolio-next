export const metadata = {
  title: 'Analítica Regional',
  description: 'Tendencias de búsqueda, reportes de zona y ranking de rubros por demanda en Neuquén y Argentina. Datos actualizados diariamente.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/analitica/' },
  openGraph: {
    title: 'Analítica Regional | Mariano Aliandri',
    description: 'Tendencias de búsqueda, reportes de zona y ranking de rubros por demanda en Neuquén y Argentina.',
    url: 'https://marianoaliandri.com.ar/analitica/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

export default function AnaliticaLayout({ children }) {
  return children;
}
