import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    allowedDevOrigins: [
      '*.cloudworkstations.dev',
      '*.firebase.studio',
    ],
    buildActivity: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        port: '',
        pathname: '/v1/create-qr-code/**',
      },
    ],
  },
};

export default nextConfig;
