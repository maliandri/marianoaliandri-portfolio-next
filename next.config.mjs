import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Carpeta del proyecto con la letra de unidad en mayúscula. En Windows, si la terminal abre el
// proyecto como "d:\..." (VS Code lo hace), Turbopack resuelve `@import "tailwindcss"` desde "d:\",
// no lo encuentra y abre un proceso de PostCSS tras otro (pasó el 2026-11-24: 234 procesos).
// En Linux (Vercel) no hay letra de unidad y queda igual.
const projectRoot = dirname(fileURLToPath(import.meta.url)).replace(/^[a-z]:/, d => d.toUpperCase());

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: projectRoot },
  trailingSlash: true,
  // pdf-parse (analizador de CV) usa pdfjs por debajo, que necesita correr
  // fuera del bundle de webpack para resolver bien su worker en serverless.
  // La tarjeta de historia (/api/publish-story/) usa satori, que carga .wasm por ruta relativa,
  // y @resvg/resvg-js, un binario nativo: ninguno de los dos se puede bundlear.
  serverExternalPackages: ['pdf-parse', 'satori', '@resvg/resvg-js'],
  // Las tipografías de la tarjeta (scripts/noticiaCard.mjs) se leen con fs: hay que incluirlas.
  outputFileTracingIncludes: {
    '/api/publish-story': ['./scripts/fonts/**'],
    '/api/mcp/[transport]': ['./scripts/fonts/**'],
    '/api/cron/contenido': ['./scripts/fonts/**'],
    '/api/cron/auditoria': ['./scripts/fonts/**'],
    '/api/publish-social': ['./scripts/fonts/**'],
    '/api/auditoria-auto/borradores': ['./scripts/fonts/**'],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.marianoaliandri.com.ar' }],
        destination: 'https://marianoaliandri.com.ar/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'marianoaliandri-portfolio-next.vercel.app' }],
        destination: 'https://marianoaliandri.com.ar/:path*',
        permanent: true,
      },
      // El pedido de presupuesto vive dentro de la tienda (con sesión): los links viejos a /presupuesto
      // abren la tienda con "Pedir presupuesto" ya elegido.
      { source: '/presupuesto', destination: '/tienda/?presupuesto=1', permanent: true },
      { source: '/presupuesto/', destination: '/tienda/?presupuesto=1', permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { hostname: 'res.cloudinary.com' },
      { hostname: 'lh3.googleusercontent.com' },
      { hostname: 'media.licdn.com' },
    ],
  },
};

export default nextConfig;
