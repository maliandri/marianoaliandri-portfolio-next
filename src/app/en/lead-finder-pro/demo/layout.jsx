export const metadata = {
  title: 'Demo — Lead Finder Pro',
  description: 'Free trial of Lead Finder Pro: see a real, complete audit, sign up to access it.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/en/lead-finder-pro/demo/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/demo/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/demo/',
    },
  },
  // Gated content, reused from /auditorias/[id] — shouldn't compete for ranking
  // with the public audit pages.
  robots: { index: false, follow: true },
};

export default function LeadFinderProDemoLayoutEn({ children }) {
  return children;
}
