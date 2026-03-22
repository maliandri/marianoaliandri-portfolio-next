/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.marianoaliandri.com.ar' }],
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
