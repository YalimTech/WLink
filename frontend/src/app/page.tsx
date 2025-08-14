'use client';

import React, { Suspense } from 'react';
import CustomPage from './custom-page/page';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <CustomPage />
    </Suspense>
  );
}
