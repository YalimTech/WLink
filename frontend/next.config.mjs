/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/app',
  assetPrefix: '/app',
  experimental: { serverActions: {} },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'googleusercontent.com',
        port: '',
        pathname: '/file_content/*',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://*.gohighlevel.com https://*.hl-platform.com",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
