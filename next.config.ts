import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.preview.emergentagent.com',
        '*.preview.emergentcf.cloud',
        'kawsay-mvp.preview.emergentagent.com',
        'kawsay-mvp.cluster-8.preview.emergentcf.cloud',
      ],
    },
  },
};

export default nextConfig;
