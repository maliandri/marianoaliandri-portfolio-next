import localFont from 'next/font/local';

// Tipografías guardadas en el repo (src/fonts, de fonts.gstatic.com, licencia OFL): bajarlas de Google en cada build
// rompía el deploy de Vercel de forma intermitente (2026-11-26, "next/font/google queries have exactly one entry").
const display = localFont({ src: [
  { path: '../../../fonts/barlow-condensed-600-latin.woff2', weight: '600' },
  { path: '../../../fonts/barlow-condensed-800-latin.woff2', weight: '800' },
], variable: '--mf-display' });
const body = localFont({ src: '../../../fonts/ibm-plex-sans-latin.woff2', weight: '400 600', variable: '--mf-body' });
const mono = localFont({ src: [
  { path: '../../../fonts/ibm-plex-mono-400-latin.woff2', weight: '400' },
  { path: '../../../fonts/ibm-plex-mono-500-latin.woff2', weight: '500' },
], variable: '--mf-mono' });

export const metadata = {
  title: 'Compras Mood Fit',
  robots: { index: false, follow: false },
};

export default function ComprasMoodfitLayout({ children }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}
