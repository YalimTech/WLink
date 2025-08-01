// wlink/frontend/src/app/oauth-success/page.tsx
'use client';

import React from 'react';

export default function OAuthSuccessPage() {
  return (
    <div className="bg-gray-100 p-4 sm:p-6 min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
        <div className="text-green-500 text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Autenticación Completa!</h1>
        <p className="text-gray-600 mb-4">Tu espacio de trabajo ha sido conectado exitosamente a WLINK.</p>
        <p className="text-gray-500 text-sm">Puedes cerrar esta página.</p>
      </div>
    </div>
  );
}
