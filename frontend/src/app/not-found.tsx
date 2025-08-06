// wlink/frontend/src/app/not-found.tsx
'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="bg-gray-100 p-4 sm:p-6 min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
        <div className="text-red-500 text-5xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Página no encontrada</h1>
        <p className="text-gray-600">La página solicitada no existe o ha sido movida.</p>
        <Link href="/app" className="mt-6 inline-block px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700">
         Volver al inicio
        </Link>
      </div>
    </div>
  );
}
