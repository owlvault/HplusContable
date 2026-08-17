import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
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
        // Firebase App Hosting.
        //
        // El matcher de Next.js (csrf-protection.js) hace que cada '*' del
        // patrón reemplace EXACTAMENTE una etiqueta entre puntos, no varias.
        // Un dominio de App Hosting tiene dos etiquetas antes de
        // "hosted.app" (backend--proyecto y región), así que '*.hosted.app'
        // no basta: hace falta un '*' por cada etiqueta variable, más el
        // dominio exacto para no depender de que el patrón siga vigente
        // si Firebase cambia la convención de nombres.
        'hplus-contable-web--hplus-contable.us-east4.hosted.app',
        '*.*.hosted.app',
        // Dominio corto por defecto (<proyecto>.web.app): una sola etiqueta.
        '*.web.app',
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
