// wlink/frontend/src/app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    // Redirige inmediatamente a la página principal de la aplicación.
    router.replace('/custom-page');
  }, [router]);

  // Se muestra un mensaje de carga mientras se produce la redirección.
  return (
    <div className="bg-gray-100 p-4 sm:p-6 min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800">Redirigiendo...</h1>
        <p className="text-gray-600">Serás llevado a la página principal de WLink.</p>
      </div>
    </div>
  );
}
