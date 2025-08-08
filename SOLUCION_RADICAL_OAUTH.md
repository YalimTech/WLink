# SOLUCIÓN RADICAL: ERR_TOO_MANY_REDIRECTS

## 🔍 DIAGNÓSTICO DEL PROBLEMA

### Síntomas Observados
```
Error: ERR_TOO_MANY_REDIRECTS
URL: wlink.prixcenter.com/oauth/callback?code=...
```

### Análisis Técnico Realizado
```bash
curl -I https://wlink.prixcenter.com/app/oauth-success
# Resultado: HTTP/2 301
# Location: https://wlink.prixcenter.com/app/oauth-success
```

**CAUSA RAÍZ IDENTIFICADA**: Bucle infinito de redirecciones causado por conflicto entre `basePath: '/app'` en Next.js y la configuración de nginx.

## 🛠️ SOLUCIÓN RADICAL IMPLEMENTADA

### 1. Eliminación del basePath en Next.js

**ANTES** (`next.config.mjs`):
```javascript
const nextConfig = {
  basePath: '/app',  // ← ESTO CAUSABA EL PROBLEMA
  output: 'standalone',
  // ...
};
```

**DESPUÉS** (`next.config.mjs`):
```javascript
const nextConfig = {
  // basePath eliminado completamente
  output: 'standalone',
  // ...
};
```

### 2. Reconfiguración Completa de Nginx

**NUEVA ARQUITECTURA** (`nginx.conf`):
```nginx
# Manejo específico para rutas de aplicación
location /app/ {
    # CLAVE: Reescribir /app/algo a /algo para Next.js
    rewrite ^/app/(.*)$ /$1 break;
    
    proxy_pass http://frontend_service;
    # ... configuración proxy
}
```

**FLUJO DE REESCRITURA**:
```
/app/oauth-success → /oauth-success (para Next.js)
/app/dashboard     → /dashboard (para Next.js)
/app/             → / (para Next.js)
```

### 3. Simplificación del Controlador OAuth

**ANTES** (lógica compleja):
```typescript
const frontendUrlFromEnv = this.configService.get<string>("FRONTEND_URL");
let redirectUrl: string;

if (frontendUrlFromEnv) {
  redirectUrl = `${frontendUrlFromEnv.replace(/\/$/, '')}/oauth-success`;
} else {
  redirectUrl = `${appUrl}/app/oauth-success`;
}
```

**DESPUÉS** (lógica simple):
```typescript
const appUrl = this.configService.get<string>("APP_URL")!;
const redirectUrl = `${appUrl}/app/oauth-success`;
```

## 🔄 NUEVO FLUJO OAUTH

```
1. Usuario instala app en GHL
   ↓
2. GHL → wlink.prixcenter.com/oauth/callback
   ↓
3. Backend procesa tokens
   ↓
4. Backend → redirect a wlink.prixcenter.com/app/oauth-success
   ↓
5. Nginx intercepta /app/oauth-success
   ↓
6. Nginx reescribe a /oauth-success
   ↓
7. Next.js sirve página oauth-success
   ↓
8. ✅ Usuario ve página de éxito (SIN BUCLES)
```

## 📋 CAMBIOS REALIZADOS

### Archivos Modificados:
1. `/workspace/frontend/next.config.mjs` - Eliminado basePath
2. `/workspace/nginx/nginx.conf` - Reconfiguración completa
3. `/workspace/backend/src/oauth/oauth.controller.ts` - Simplificación
4. `/workspace/ENV_CONFIG_DOKPLOY.md` - Documentación actualizada
5. `/workspace/verify-oauth-fix.sh` - Script de verificación mejorado

### Variables de Entorno Simplificadas:
```bash
# ANTES: Se necesitaban ambas
APP_URL=https://wlink.prixcenter.com
FRONTEND_URL=https://wlink.prixcenter.com/app

# DESPUÉS: Solo se necesita una
APP_URL=https://wlink.prixcenter.com
# FRONTEND_URL ya no es necesaria
```

## 🧪 VERIFICACIÓN DE LA SOLUCIÓN

### Prueba Crítica:
```bash
curl -I https://wlink.prixcenter.com/app/oauth-success
# ESPERADO: HTTP/2 200 (NO 301 en bucle)
```

### Script de Verificación:
```bash
chmod +x verify-oauth-fix.sh
./verify-oauth-fix.sh
```

**Resultado Esperado**:
```
✅ ÉXITO: Página oauth-success responde correctamente (200)
🎉 VERIFICACIÓN EXITOSA - La solución radical funcionó
```

## 🎯 CONFIGURACIÓN FINAL REQUERIDA

### En Dokploy:
```bash
APP_URL=https://wlink.prixcenter.com
# + otras variables según documentación
```

### En GoHighLevel:
```
Redirect URI: https://wlink.prixcenter.com/oauth/callback
```

## 🚀 RESULTADOS ESPERADOS

- ❌ **ANTES**: `ERR_TOO_MANY_REDIRECTS`
- ✅ **DESPUÉS**: OAuth funciona perfectamente
- ✅ **LOGS**: `[OAuth Callback] Redirigiendo a la página de éxito: https://wlink.prixcenter.com/app/oauth-success`
- ✅ **USUARIO**: Ve página de confirmación OAuth exitosa

## 🔧 BENEFICIOS DE LA SOLUCIÓN

1. **Simplicidad**: Eliminada la complejidad del basePath
2. **Mantenibilidad**: Configuración más clara y directa
3. **Robustez**: Menos puntos de fallo potenciales
4. **Escalabilidad**: Estructura más limpia para futuras funcionalidades

Esta solución **elimina completamente** la causa raíz del problema y debe funcionar sin errores de redirección.