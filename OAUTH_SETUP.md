# Configuración OAuth - GoHighLevel Integration

## Problema: Bucle de Redirecciones (ERR_TOO_MANY_REDIRECTS)

### Síntomas
- La página muestra "ERR_TOO_MANY_REDIRECTS" después de intentar instalar la app en GoHighLevel
- El callback OAuth no funciona correctamente

### Causa
El problema principal era la falta de la variable de entorno `FRONTEND_URL` en la configuración del backend, junto con una configuración de Nginx que eliminaba el prefijo `/app` al reenviar al frontend, lo que generaba bucles de redirección.

### Solución Implementada

1. **Agregada variable FRONTEND_URL al entorno**:
   ```yaml
   environment:
     - FRONTEND_URL=${FRONTEND_URL}
   ```

2. **Mejorado el controlador OAuth** para manejar el caso donde `FRONTEND_URL` no esté definida:
   - Ahora usa `APP_URL/app` como fallback
   - Registra un warning en lugar de lanzar una excepción

3. **Nginx ajustado** para preservar el prefijo `/app`:
   - `proxy_pass http://frontend_service;` (sin barra final) dentro de `location /app/ { ... }`

### Variables de Entorno Requeridas

Para una configuración correcta, asegúrate de que estas variables estén definidas:

```bash
# URL principal de la aplicación
APP_URL=https://tu-dominio.com

# URL del frontend (opcional, usa APP_URL/app como fallback)
FRONTEND_URL=https://tu-dominio.com/app

# Credenciales de GoHighLevel
GHL_CLIENT_ID=tu_client_id
GHL_CLIENT_SECRET=tu_client_secret
```

### Flujo OAuth Correcto

1. **Autorización**: GoHighLevel redirige a `${APP_URL}/oauth/callback`
2. **Callback**: El backend procesa el código y tokens
3. **Redirección**: El backend redirige a `${FRONTEND_URL}/custom-page?locationId=...`
4. **Éxito**: El usuario entra directo al panel dentro de GHL

### Configuración en GoHighLevel

En tu aplicación de GoHighLevel, asegúrate de que la **Redirect URI** esté configurada como:
```
https://tu-dominio.com/oauth/callback
```

### Nginx Configuration

El nginx.conf ya está configurado correctamente para manejar:
- `/oauth/*` → Backend (puerto 3000)
- `/app/*` → Frontend (puerto 3001) con `proxy_pass` sin barra final

### Troubleshooting

Si el problema persiste:

1. Verifica que todas las variables de entorno estén definidas
2. Revisa los logs del backend para errores específicos
3. Asegúrate de que la Redirect URI en GoHighLevel coincida exactamente
4. Verifica que los servicios backend y frontend estén corriendo en los puertos correctos (3000 y 3001)