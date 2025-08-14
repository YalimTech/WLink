// wlink/frontend/src/app/layout.tsx
import './globals.css'; // Importa los estilos globales, incluyendo los que se movieron aquí.
import React from 'react'; // Importa React explícitamente

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Favicon de la aplicación */}
        <link rel="icon" href="/favicon.ico" />
        
        {/* Hoja de estilos de Font Awesome para iconos */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
        
        {/* El script de qrcode.min.js y los estilos CSS específicos de modales/spinners
          se han movido a custom-page/page.tsx o a globals.css para una mejor organización
          y optimización de Next.js.
        */}
      </head>
      <body>{children}</body>
    </html>
  );
}
