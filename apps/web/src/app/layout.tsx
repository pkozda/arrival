import type { Metadata } from 'next';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@arrivalos/core';
import { AppProvider } from '@/components/AppProvider';
import { ThemeScript } from '@/components/ThemeScript';
import './globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — Decision Support for Migrants in Germany`,
  description: PRODUCT_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
