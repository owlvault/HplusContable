import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HplusContable | DigiKawsay',
  description: 'Software Contable Inteligente y Regulado',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Suppress hydration warnings from browser extensions
            window.__NEXT_HYDRATION_ERROR_INFO = { shouldShowDevOverlay: false };
          `
        }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
