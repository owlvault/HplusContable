import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.preview.emergentagent.com',
        '*.preview.emergentcf.cloud',
        '*.cluster-8.preview.emergentcf.cloud',
        'factura-treasury.preview.emergentagent.com',
        'factura-treasury.cluster-8.preview.emergentcf.cloud',
        'kawsay-mvp.preview.emergentagent.com',
        'kawsay-mvp.cluster-8.preview.emergentcf.cloud',
      ],
    },
  },
  // Transpile @react-pdf packages for compatibility
  transpilePackages: ['@react-pdf/renderer', '@react-pdf/layout'],
  webpack: (config) => {
    // Fix for yoga-layout/load module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      'yoga-layout/load': 'yoga-layout',
    };
    return config;
  },
};

export default nextConfig;
