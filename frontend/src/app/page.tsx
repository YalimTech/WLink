'use client';

// Importa el componente CustomPage directamente.
// Esto asume que 'custom-page/page.tsx' exporta su componente principal como default.
import CustomPage from './custom-page/page';

/**
 * Componente de la página principal (root) de la aplicación.
 *
 * Este componente ahora renderiza directamente el contenido de CustomPage,
 * eliminando la necesidad de una redirección del lado del cliente desde la raíz.
 * Esto asegura que cuando los usuarios accedan a la URL base de la aplicación
 * (por ejemplo, /app/whatsapp), vean inmediatamente el contenido deseado
 * sin pasos intermedios de redirección.
 */
export default function Page() {
  return (
    // Renderiza el componente CustomPage directamente.
    // Esto hace que el contenido de CustomPage sea la página de inicio
    // cuando se accede a la ruta base de la aplicación Next.js.
    <CustomPage />
  );
}
