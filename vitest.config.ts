import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
    test: {
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        // tools/sales-sync es un paquete aparte con sus propias pruebas sobre
        // el runner de Node (`npm test` dentro de esa carpeta).
        exclude: ['node_modules/**', 'tools/**', '.next/**'],
    },
});
