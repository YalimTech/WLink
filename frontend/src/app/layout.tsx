// wlink/frontend/src/app/layout.tsx
import './globals.css';
import React from 'react';
import { headers } from 'next/headers';
import GhlContext from '@/components/GhlContext';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const enc = hdrs.get('x-ghl-context') || hdrs.get('x-lc-context') || '';

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
        </head>
      <body>
        <GhlContext enc={enc} />
        {children}
      </body>
    </html>
  );
}