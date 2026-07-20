import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

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
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Suppress hydration warnings from browser extensions
            window.__NEXT_HYDRATION_ERROR_INFO = { shouldShowDevOverlay: false };
          `
        }} />
      </head>
      <body suppressHydrationWarning className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
