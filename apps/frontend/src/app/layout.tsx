import React from 'react';

export const metadata = {
  title: 'Legal Document AI Assistant',
  description: 'AI-powered legal document analysis and simplification',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}