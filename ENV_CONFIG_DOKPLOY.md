# Configuración de Variables de Entorno - DOKPLOY

## 🚨 SOLUCIÓN PARA ERR_TOO_MANY_REDIRECTS

Este documento contiene la configuración **EXACTA** necesaria para resolver el error `ERR_TOO_MANY_REDIRECTS` en WLINK.

### ✅ CAUSA DEL PROBLEMA IDENTIFICADA

El error se debía a:
1. **Configuración incorrecta** en el controlador OAuth
2. **Conflictos en nginx** entre reglas de enrutamiento
3. **Problemas con basePath** de Next.js

### 🔧 VARIABLES DE ENTORNO REQUERIDAS

Configura estas variables en Dokploy **EXACTAMENTE** como se muestra:

```bash
# === URLS PRINCIPALES (CRÍTICAS) ===
APP_URL=https://wlink.prixcenter.com
FRONTEND_URL=https://wlink.prixcenter.com/app

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

### 🔄 FLUJO OAUTH CORREGIDO

1. **Usuario instala app** → GHL redirige a `wlink.prixcenter.com/oauth/callback`
2. **Backend procesa OAuth** → Intercambia code por tokens
3. **Backend redirige** → A `wlink.prixcenter.com/app/oauth-success`
4. **Usuario ve página de éxito** → ✅ Proceso completado SIN bucles

### 🛠️ CAMBIOS IMPLEMENTADOS

#### A. Controlador OAuth Corregido
- ✅ Lógica de redirección mejorada
- ✅ Manejo correcto del basePath de Next.js
- ✅ Logging detallado para debugging
- ✅ Validación de URLs
- ✅ Redirección 301 en lugar de 302

#### B. Nginx Optimizado
- ✅ Eliminadas reglas duplicadas
- ✅ Simplificado enrutamiento
- ✅ Configuración anti-bucles
- ✅ Proxy optimizado para Next.js

### 🧪 VERIFICACIÓN DESPUÉS DEL DEPLOY

1. **Revisa los logs** del backend para ver:
```
[OAuth Callback] APP_URL: https://wlink.prixcenter.com
[OAuth Callback] FRONTEND_URL desde env: https://wlink.prixcenter.com/app
[OAuth Callback] URL de redirección construida: https://wlink.prixcenter.com/app/oauth-success
[OAuth Callback] Redirigiendo a la página de éxito: https://wlink.prixcenter.com/app/oauth-success
```

2. **Prueba el flujo OAuth**:
   - Ve a GoHighLevel marketplace
   - Instala tu aplicación
   - Debe redirigir a la página de éxito SIN errores

### 🆘 TROUBLESHOOTING

Si aún hay problemas:

1. **Verifica variables**:
```bash
# En Dokploy, asegúrate de que estas estén configuradas
echo $APP_URL
echo $FRONTEND_URL
```

2. **Revisa logs**:
   - Backend: logs de `[OAuth Callback]`
   - Nginx: logs de acceso y errores

3. **Verifica GHL**:
   - Redirect URI: `https://wlink.prixcenter.com/oauth/callback`
   - App status: "Published" o "Live"

### 📞 CONTACTO

Si el problema persiste después de implementar estos cambios:
1. Proporciona logs del backend
2. Screenshot del error
3. Configuración exacta de GoHighLevel