/** @type {import('next').NextConfig} */
const nextConfig = {
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
    '/api/cron/demanda': ['./scripts/fonts/**'],
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
