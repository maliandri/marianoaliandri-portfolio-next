import './globals.css';
import { Providers } from './providers';

export const metadata = {
  metadataBase: new URL('https://marianoaliandri.com.ar'),
  title: {
    default: 'Mariano Aliandri | Dev. Full Stack, React, Python & Data',
    template: '%s | Mariano Aliandri',
  },
  description: 'Desarrollador Full Stack y Analista de Datos con experiencia en React y Python. Sistemas a medida en la nube, con base de datos y backend, y páginas web para empresas en Neuquén y toda Argentina.',
  keywords: ['React', 'Python', 'Power BI', 'Full Stack', 'Developer', 'Data Analytics', 'Argentina', 'Neuquén', 'diseño web Neuquén', 'páginas web para empresas', 'sistemas a medida', 'sistemas en la nube', 'desarrollo backend'],
  authors: [{ name: 'Mariano Aliandri' }],
  creator: 'Mariano Aliandri',
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: 'https://marianoaliandri.com.ar',
    siteName: 'Mariano Aliandri Portfolio',
    title: 'Mariano Aliandri | Dev. Full Stack, React, Python & Data',
    description: 'Desarrollador Full Stack y Analista de Datos con experiencia en React y Python.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Mariano Aliandri — Full Stack Developer & Data Analyst',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mariano Aliandri | Dev. Full Stack',
    description: 'Desarrollador Full Stack y Analista de Datos',
    images: ['/og-image.jpg'],
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
        {/* Favicon dinámico: cambia el emoji según el día de la semana */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var e=['😴','😊','😄','🥳','😎','🤩','😁'];var d=new Date().getDay();var em=e[d];var svg='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">'+em+'</text></svg>';document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(function(l){l.remove();});var n=document.createElement('link');n.rel='icon';n.href=svg;document.head.appendChild(n);})();`,
          }}
        />
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
