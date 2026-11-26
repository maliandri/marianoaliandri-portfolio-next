import localFont from 'next/font/local';

// Solo para las páginas /ia-para: títulos con carácter (Bricolage) y el "comprobante" de lo que
// hizo la IA en monoespaciada. El texto corrido sigue siendo Inter, como el resto del sitio.
// Bricolage va guardada en el repo (variable, latin): bajarla de Google en cada build rompía el deploy de Vercel
// a veces (2026-11-26: Google la servía como /l/font?kit=… y Turbopack fallaba con "next/font/google queries
// have exactly one entry"). Archivo de fonts.gstatic.com, licencia OFL.
export const display = localFont({
  src: '../../fonts/bricolage-grotesque-latin.woff2',
  weight: '200 800',
  variable: '--font-ia-display',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});
export const mono = localFont({ src: '../../fonts/jetbrains-mono-latin.woff2', weight: '400 600', variable: '--font-ia-mono', display: 'swap', fallback: ['ui-monospace', 'monospace'] });

// Manuscrita para el pie de las polaroids del home (estilo unseen.co). Sin preload: está abajo
// de todo y no puede competir con el LCP; si tarda, se ve la de respaldo y después cambia.
export const hand = localFont({ src: '../../fonts/caveat-latin.woff2', weight: '400 700', variable: '--font-hand', display: 'swap', preload: false, fallback: ['cursive'] });
