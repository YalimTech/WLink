# Configuración de GoHighLevel para WLink

## Variables de Entorno Requeridas

Para que la aplicación funcione correctamente con GoHighLevel, es **OBLIGATORIO** configurar las siguientes variables de entorno:

### 1. GHL_SHARED_SECRET (CRÍTICO)
- **Descripción**: Clave secreta compartida para desencriptar los datos de contexto de GoHighLevel
- **Formato**: String alfanumérico
- **Ejemplo**: `GHL_SHARED_SECRET=tu_clave_secreta_aqui`
- **Dónde obtenerla**: En tu cuenta de GoHighLevel, en la configuración de tu aplicación personalizada

### 2. Variables de URL
- **APP_URL**: URL base de tu aplicación (ej: `https://wlink.prixcenter.com`)
- **FRONTEND_URL**: URL del frontend (normalmente igual a APP_URL)

### 3. Variables de OAuth (para integración completa)
- **GHL_CLIENT_ID**: ID de cliente de tu aplicación en GoHighLevel
- **GHL_CLIENT_SECRET**: Secreto de cliente de tu aplicación en GoHighLevel
- **GHL_REDIRECT_URI**: URI de redirección OAuth (ej: `https://wlink.prixcenter.com/oauth/callback`)

## Configuración en Dokploy

1. Ve a la configuración de tu aplicación en Dokploy
2. En la sección de variables de entorno, agrega:
   ```
   GHL_SHARED_SECRET=tu_clave_secreta_de_ghl
   APP_URL=https://wlink.prixcenter.com
   FRONTEND_URL=https://wlink.prixcenter.com
   GHL_CLIENT_ID=tu_client_id
   GHL_CLIENT_SECRET=tu_client_secret
   GHL_REDIRECT_URI=https://wlink.prixcenter.com/oauth/callback
   ```
3. Reconstruye y redespliega la aplicación

## Solución de Problemas

### Error: "No se encontraron datos encriptados en la URL"
**Causas posibles:**
1. La variable `GHL_SHARED_SECRET` no está configurada
2. La aplicación no está siendo accedida desde GoHighLevel
3. El contexto encriptado no se está pasando correctamente

**Soluciones:**
1. Verifica que todas las variables de entorno estén configuradas
2. Asegúrate de acceder a la aplicación desde el menú de aplicaciones en GoHighLevel
3. Verifica que la aplicación esté correctamente instalada en tu ubicación de GoHighLevel

### Error: "Shared secret not configured on the server"
**Causa:** La variable `GHL_SHARED_SECRET` no está configurada en el servidor
**Solución:** Configura la variable en Dokploy y redespliega

### Error: "Invalid GHL context: decryption failed"
**Causa:** La clave secreta configurada no coincide con la de GoHighLevel
**Solución:** Verifica que la `GHL_SHARED_SECRET` sea exactamente la misma que en GoHighLevel

## Verificación de la Configuración

Para verificar que todo esté configurado correctamente:

1. Accede a los logs de la aplicación en Dokploy
2. Busca mensajes como:
   - "GHL context received in header on app load" (correcto)
   - "GHL context header (x-ghl-context) not found" (indica problema)
3. Verifica que no haya errores de "GHL_SHARED_SECRET not configured"