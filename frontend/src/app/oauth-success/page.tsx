'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function OAuthSuccess() {
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(10);
  const locationId = searchParams.get('locationId');
  const status = searchParams.get('status');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirigir a GoHighLevel después del contador
          window.location.href = 'https://app.gohighlevel.com';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (status !== 'success') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Error en la Autorización</h1>
          <p className="text-gray-600 mb-6">
            Hubo un problema al autorizar la aplicación. Por favor, intenta de nuevo.
          </p>
          <button
            onClick={() => window.location.href = 'https://app.gohighlevel.com'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Volver a GoHighLevel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-green-500 text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Autorización Exitosa!</h1>
          <p className="text-gray-600">
            La aplicación WLink ha sido autorizada correctamente.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">
            Próximos pasos:
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Regresa a tu cuenta de GoHighLevel</li>
            <li>Ve al menú de aplicaciones</li>
            <li>Abre la aplicación WLink</li>
            <li>La aplicación ahora estará completamente configurada</li>
          </ol>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">
            Serás redirigido automáticamente en {countdown} segundos...
          </p>
          <button
            onClick={() => window.location.href = 'https://app.gohighlevel.com'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Ir a GoHighLevel ahora
          </button>
        </div>

        {locationId && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              Location ID: {locationId}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
