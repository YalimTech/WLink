# Guía de Debugging OAuth - ERR_TOO_MANY_REDIRECTS

## Problema Actual
Tu aplicación está mostrando `ERR_TOO_MANY_REDIRECTS` en la URL:
`wlink.prixcenter.com/oauth/callback?code=f5c135891052...`

## Pasos de Solución

### 1. Verificar Variables de Entorno
Asegúrate de que estas variables estén configuradas correctamente en Dokploy:

```bash
APP_URL=https://wlink.prixcenter.com
FRONTEND_URL=https://wlink.prixcenter.com/app
```

**IMPORTANTE**: No debe haber slash final en ninguna de estas URLs.

### 2. Configuración en GoHighLevel
En tu aplicación de GoHighLevel, la **Redirect URI** debe ser exactamente:
```
https://wlink.prixcenter.com/oauth/callback
```

### 3. Flujo OAuth Esperado
1. **Usuario instala app en GHL** → GHL redirige a `wlink.prixcenter.com/oauth/callback`
2. **Backend procesa OAuth** → Intercambia code por tokens
3. **Backend redirige** → A `wlink.prixcenter.com/app/custom-page?locationId=...`
4. **Usuario ve su panel** → Proceso completado

### 4. Cambios Implementados

#### A. Nginx Configuration
- ✅ Redirección a `/app/custom-page?locationId=...`
- ✅ Desactivado buffering para evitar problemas con redirects
- ✅ Configurado `proxy_redirect off`

#### B. OAuth Controller
- ✅ Agregado logging detallado para debugging
- ✅ Cambiado a redirect temporal (302) para debugging
- ✅ Mejorada limpieza de URLs

### 5. Verificación de la Solución

#### Paso 1: Verificar Variables
```bash
# En Dokploy, verifica que estas variables estén configuradas:
echo $APP_URL
echo $FRONTEND_URL
```

#### Paso 2: Verificar Logs
Después del deployment, revisa los logs del backend para ver:
```
[GhlOauthController] APP_URL: https://wlink.prixcenter.com
[GhlOauthController] FRONTEND_URL from env: https://wlink.prixcenter.com/app
[GhlOauthController] Final frontendUrl: https://wlink.prixcenter.com/app
[GhlOauthController] Redirigiendo a la página de éxito del frontend: https://wlink.prixcenter.com/app/oauth-success
```

#### Paso 3: Probar OAuth Flow
1. Ve a GoHighLevel marketplace
2. Instala tu aplicación
3. Debe redirigir correctamente sin loops

### 6. Si el Problema Persiste

#### Verificar en Dokploy:
1. **Variables de entorno**: Asegúrate de que `FRONTEND_URL` esté configurada
2. **Restart**: Reinicia la aplicación después de cambiar variables
3. **Logs**: Revisa logs tanto del nginx como del backend

#### Verificar en GoHighLevel:
1. **Redirect URI**: Debe ser exactamente `https://wlink.prixcenter.com/oauth/callback`
2. **App Status**: Asegúrate de que la app esté "Published" o "Live"

### 7. Comandos de Debugging

#### Para verificar la configuración:
```bash
# Verificar que nginx se recargó correctamente
nginx -t && nginx -s reload

# Verificar que el backend está corriendo
curl -I http://localhost:3000/oauth/callback

# Verificar que el frontend está corriendo
curl -I http://localhost:3001/custom-page?locationId=test
```

### 8. Contacto para Soporte
Si después de estos pasos el problema persiste, provee:
1. Screenshot del error
2. Variables de entorno configuradas (sin secrets)
3. Logs del backend durante el OAuth flow
4. Configuración exacta en GoHighLevel