import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.preview.emergentagent.com',
        '*.preview.emergentcf.cloud',
        'contabilidad-app-9.preview.emergentagent.com',
        'contabilidad-app-9.cluster-8.preview.emergentcf.cloud',
      ],
    },
  },
};

export default nextConfig;
