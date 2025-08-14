/** @type {import('next').NextConfig} */
const nextConfig = {
  
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*', // Reenvía /api/ al backend
        destination: `http://localhost:3000/api/:path*`,
      },
      {
        source: '/webhooks/:path*', // Reenvía /webhooks/ al backend
        destination: `http://localhost:3000/webhooks/:path*`,
      },
    ];
  },
};

export default nextConfig;