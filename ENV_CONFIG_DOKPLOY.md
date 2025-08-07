# Configuración de Variables de Entorno para Dokploy

## Variables Requeridas para Solucionar ERR_TOO_MANY_REDIRECTS

Para que la integración con GoHighLevel funcione correctamente en Dokploy, asegúrate de configurar las siguientes variables de entorno:

### Variables Principales
```bash
# URL de tu aplicación en Dokploy (reemplaza con tu dominio real)
APP_URL=https://tu-dominio.dokploy.app

# URL del frontend (CRÍTICO para evitar redirects loops)
# Debe apuntar al path /app de tu aplicación
FRONTEND_URL=https://tu-dominio.dokploy.app/app

# Credenciales de GoHighLevel (obtén estos de tu app en GHL)
GHL_CLIENT_ID=tu_client_id_de_ghl
GHL_CLIENT_SECRET=tu_client_secret_de_ghl
GHL_CONVERSATION_PROVIDER_ID=tu_provider_id
GHL_SHARED_SECRET=tu_shared_secret

# URLs de Evolution API
EVOLUTION_API_URL=https://evo.tu-dominio.com
EVOLUTION_CONSOLE_URL=https://evo.tu-dominio.com/manager

# Token de instancia para Evolution API
INSTANCE_TOKEN=tu_token_de_instancia

# Base de datos
DATABASE_URL=postgresql://user:password@host:port/database
```

### Configuración en GoHighLevel

En tu aplicación de GoHighLevel, configura la **Redirect URI** como:
```
https://tu-dominio.dokploy.app/oauth/callback
```

### Verificación de la Configuración

1. **Verifica que FRONTEND_URL esté configurada correctamente**:
   - Debe terminar en `/app` (sin slash final)
   - Ejemplo: `https://miapp.dokploy.app/app`

2. **Verifica la Redirect URI en GHL**:
   - Debe apuntar a `/oauth/callback` de tu dominio
   - Ejemplo: `https://miapp.dokploy.app/oauth/callback`

3. **Flujo OAuth esperado**:
   - GHL redirige a: `https://tu-dominio.dokploy.app/oauth/callback`
   - Backend procesa y redirige a: `https://tu-dominio.dokploy.app/app/oauth-success`
   - Usuario ve página de éxito

### Solución Aplicada

Se han hecho los siguientes cambios para solucionar el problema:

1. **OAuth Controller**: Mejorado para limpiar URLs y evitar double slashes
2. **Nginx Config**: Simplificado para evitar conflictos de redirección
3. **Environment Variables**: Documentadas todas las variables críticas

### Troubleshooting

Si aún tienes problemas:

1. Verifica los logs del backend en Dokploy
2. Asegúrate de que las variables FRONTEND_URL y APP_URL están correctamente configuradas
3. Revisa que la Redirect URI en GoHighLevel coincida exactamente
4. Verifica que no hay caracteres especiales o espacios en las variables de entorno