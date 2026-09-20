export const metadata = {
  title: 'Search businesses — Lead Finder Pro',
  description: 'Audit local businesses in your area: search for free and run full audits with your credits.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/en/lead-finder-pro/buscar/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/buscar/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/buscar/',
    },
  },
  robots: { index: false, follow: true },
  manifest: '/lead-finder-pro-manifest.json',
  themeColor: '#4f46e5',
};

export default function BuscarLayoutEn({ children }) {
  return children;
}
