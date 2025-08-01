/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/app/whatsapp',
  assetPrefix: '/app/whatsapp/',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: { serverActions: {} },
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
};
export default nextConfig;
