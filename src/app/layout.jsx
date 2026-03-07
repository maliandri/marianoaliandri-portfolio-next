import './globals.css';
import { Providers } from './providers';

export const metadata = {
  metadataBase: new URL('https://marianoaliandri.com.ar'),
  title: {
    default: 'Mariano Aliandri | Dev. Full Stack, React, Python & Data',
    template: '%s | Mariano Aliandri',
  },
  description: 'Desarrollador Full Stack y Analista de Datos con experiencia en React y Python. Explora mi portfolio de proyectos y habilidades en Power BI.',
  keywords: ['React', 'Python', 'Power BI', 'Full Stack', 'Developer', 'Data Analytics', 'Argentina'],
  authors: [{ name: 'Mariano Aliandri' }],
  creator: 'Mariano Aliandri',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://marianoaliandri.com.ar',
    siteName: 'Mariano Aliandri Portfolio',
    title: 'Mariano Aliandri | Dev. Full Stack, React, Python & Data',
    description: 'Desarrollador Full Stack y Analista de Datos con experiencia en React y Python.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mariano Aliandri | Dev. Full Stack',
    description: 'Desarrollador Full Stack y Analista de Datos',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://marianoaliandri-3b135.firebaseapp.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
        {/* Script síncrono: aplica dark mode ANTES de que React hidrate — evita flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t!=='light'){document.documentElement.classList.add('dark');if(!t)localStorage.setItem('theme','dark');}})();`,
          }}
        />
        {/* Desregistra service workers del sitio anterior (Netlify) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister();});});}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
