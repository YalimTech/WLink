# Configuración de Variables de Entorno - DOKPLOY

## 🚨 SOLUCIÓN RADICAL PARA ERR_TOO_MANY_REDIRECTS

Este documento contiene la **SOLUCIÓN DEFINITIVA** al error `ERR_TOO_MANY_REDIRECTS` en WLINK.

### 🔧 PROBLEMA RESUELTO

El error se debía a **conflictos del basePath** en Next.js que causaba bucles infinitos de redirección.

**SOLUCIÓN APLICADA:**
- ✅ **Eliminado `basePath: '/app'`** de Next.js
- ✅ **Reconfigurado nginx** para manejar rutas sin basePath
- ✅ **Simplificado el controlador OAuth** para redirecciones directas

### 🔧 VARIABLES DE ENTORNO REQUERIDAS

Configura estas variables en Dokploy **EXACTAMENTE** como se muestra:

```bash
# === URLS PRINCIPALES (SIMPLIFICADAS) ===
APP_URL=https://wlink.prixcenter.com

# NOTA: FRONTEND_URL ya no es necesaria con la nueva configuración

# === CREDENCIALES GOHIGHLEVEL ===
GHL_CLIENT_ID=tu_client_id_aqui
GHL_CLIENT_SECRET=tu_client_secret_aqui
GHL_CONVERSATION_PROVIDER_ID=tu_provider_id_aqui
GHL_SHARED_SECRET=tu_shared_secret_aqui

# === EVOLUTION API ===
EVOLUTION_API_URL=https://evo.tu-dominio.com
EVOLUTION_CONSOLE_URL=https://evo.tu-dominio.com/manager
INSTANCE_TOKEN=tu_token_de_instancia

# === BASE DE DATOS ===
DATABASE_URL=postgresql://user:password@host:port/database
```

### 📋 CONFIGURACIÓN EN GOHIGHLEVEL

En tu aplicación de GoHighLevel, configura la **Redirect URI** como:
```
https://wlink.prixcenter.com/oauth/callback
```

### 🔄 NUEVO FLUJO OAUTH (SIN BASEPATH)

1. **Usuario instala app** → GHL redirige a `wlink.prixcenter.com/oauth/callback`
2. **Backend procesa OAuth** → Intercambia code por tokens
3. **Backend redirige** → A `wlink.prixcenter.com/app/oauth-success`
4. **Nginx reescribe** → `/app/oauth-success` se convierte en `/oauth-success` para Next.js
5. **Usuario ve página de éxito** → ✅ **SIN BUCLES DE REDIRECCIÓN**

### 🛠️ CAMBIOS IMPLEMENTADOS

#### A. Next.js Simplificado
- ✅ **Eliminado `basePath: '/app'`** que causaba los bucles
- ✅ **Configuración limpia** sin complicaciones

#### B. Nginx Completamente Reconfigurado
- ✅ **Reescritura de rutas** `/app/algo` → `/algo` para Next.js
- ✅ **Sin reglas conflictivas** que causen bucles
- ✅ **Manejo correcto** de todas las rutas

#### C. Controlador OAuth Simplificado
- ✅ **Redirección directa** sin lógica compleja
- ✅ **Logging mejorado** para debugging
- ✅ **URL simple**: `APP_URL/app/oauth-success`

### 🧪 VERIFICACIÓN DESPUÉS DEL DEPLOY

1. **Revisa los logs** del backend para ver:
```
[OAuth Callback] APP_URL: https://wlink.prixcenter.com
[OAuth Callback] URL de redirección construida: https://wlink.prixcenter.com/app/oauth-success
[OAuth Callback] Redirigiendo a la página de éxito: https://wlink.prixcenter.com/app/oauth-success
```

2. **Prueba directamente**:
```bash
curl -I https://wlink.prixcenter.com/app/oauth-success
# Debe devolver 200, NO 301 en bucle
```

3. **Prueba el flujo OAuth**:
   - Ve a GoHighLevel marketplace
   - Instala tu aplicación
   - Debe redirigir exitosamente SIN errores

### 🆘 NUEVA ARQUITECTURA

```
Solicitud: /app/oauth-success
    ↓
Nginx intercepta /app/*
    ↓
Reescribe a /oauth-success
    ↓
Envía a Next.js (puerto 3001)
    ↓
Next.js sirve la página oauth-success
    ↓
✅ Usuario ve página de éxito
```

### 📞 RESULTADO ESPERADO

- ❌ **ANTES**: `ERR_TOO_MANY_REDIRECTS`
- ✅ **DESPUÉS**: Página de éxito OAuth funcionando perfectamente

Esta solución **elimina completamente** el problema del basePath y debe funcionar sin errores.