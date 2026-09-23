/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  // pdf-parse (analizador de CV) usa pdfjs por debajo, que necesita correr
  // fuera del bundle de webpack para resolver bien su worker en serverless.
  serverExternalPackages: ['pdf-parse'],
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
