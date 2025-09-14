'use client';

import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { theme } from '../theme';
import { AppLayout } from '../components/Layout';
// import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import { mobileOptimizer } from '../utils/mobileOptimizations';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Initialize mobile optimizations
    mobileOptimizer.initialize();
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Legal Document AI Assistant</title>
        <meta name="description" content="AI-powered legal document analysis and simplification" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#1976d2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LegalAI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1976d2" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        
        {/* Preload critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppLayout>
            {children}
            {/* <PWAInstallPrompt /> */}
          </AppLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}