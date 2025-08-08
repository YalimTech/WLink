#!/bin/bash

# Script de Verificación - SOLUCIÓN RADICAL ERR_TOO_MANY_REDIRECTS
# Ejecutar después del deployment para verificar la nueva configuración

echo "🔍 VERIFICANDO SOLUCIÓN RADICAL OAUTH - WLINK"
echo "============================================="
echo

# Verificar variables de entorno críticas
echo "📋 1. VERIFICANDO VARIABLES DE ENTORNO:"
echo "---------------------------------------"

if [ -z "$APP_URL" ]; then
    echo "❌ ERROR: APP_URL no está configurada"
    exit 1
else
    echo "✅ APP_URL: $APP_URL"
fi

# FRONTEND_URL ya no es necesaria
if [ -n "$FRONTEND_URL" ]; then
    echo "ℹ️  INFO: FRONTEND_URL configurada (ya no necesaria): $FRONTEND_URL"
else
    echo "✅ FRONTEND_URL: No configurada (correcto con nueva arquitectura)"
fi

echo

# Verificar servicios
echo "🔧 2. VERIFICANDO SERVICIOS:"
echo "----------------------------"

# Verificar backend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/oauth/callback | grep -q "405\|400"; then
    echo "✅ Backend (puerto 3000): Activo"
else
    echo "❌ Backend (puerto 3000): No responde correctamente"
fi

# Verificar frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200\|301\|302"; then
    echo "✅ Frontend (puerto 3001): Activo"
else
    echo "❌ Frontend (puerto 3001): No responde correctamente"
fi

echo

# Verificar configuración de nginx
echo "🌐 3. VERIFICANDO NGINX:"
echo "------------------------"

if nginx -t 2>/dev/null; then
    echo "✅ Configuración de nginx: Válida"
else
    echo "❌ Configuración de nginx: Inválida"
fi

echo

# PRUEBA CRÍTICA: Verificar que NO hay bucles de redirección
echo "🚨 4. PRUEBA CRÍTICA - VERIFICANDO BUCLES:"
echo "-----------------------------------------"

OAUTH_SUCCESS_URL="$APP_URL/app/oauth-success"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$OAUTH_SUCCESS_URL")
LOCATION=$(curl -s -I "$OAUTH_SUCCESS_URL" | grep -i "location:" | cut -d' ' -f2 | tr -d '\r')

echo "URL probada: $OAUTH_SUCCESS_URL"
echo "Código HTTP: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ ÉXITO: Página oauth-success responde correctamente (200)"
elif [ "$HTTP_CODE" = "301" ] && [ "$LOCATION" = "$OAUTH_SUCCESS_URL" ]; then
    echo "❌ ERROR: BUCLE DE REDIRECCIÓN DETECTADO"
    echo "   La página redirige a sí misma: $LOCATION"
    echo "   Esto indica que el problema persiste"
elif [ "$HTTP_CODE" = "301" ]; then
    echo "⚠️  REDIRECT: Redirige a $LOCATION"
    echo "   Esto podría estar bien dependiendo del destino"
else
    echo "⚠️  CÓDIGO $HTTP_CODE: Respuesta inesperada"
fi

echo

# Verificar endpoint OAuth
echo "🔐 5. VERIFICANDO ENDPOINT OAUTH:"
echo "---------------------------------"

if curl -s -o /dev/null -w "%{http_code}" "$APP_URL/oauth/callback" | grep -q "405\|400"; then
    echo "✅ Endpoint OAuth ($APP_URL/oauth/callback): Disponible"
else
    echo "❌ Endpoint OAuth ($APP_URL/oauth/callback): No disponible"
fi

echo

# Verificar reescritura de nginx
echo "🔄 6. VERIFICANDO REESCRITURA DE NGINX:"
echo "---------------------------------------"

echo "Probando que /app/test se reescriba correctamente..."
TEST_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/app/test")
if [ "$TEST_CODE" = "404" ]; then
    echo "✅ Reescritura funciona: /app/test → 404 (esperado para página inexistente)"
else
    echo "⚠️  Código $TEST_CODE para /app/test (podría estar bien)"
fi

echo

# Instrucciones finales
echo "📝 PRÓXIMOS PASOS:"
echo "------------------"
echo "1. Asegúrate de que la PRUEBA CRÍTICA muestre ✅"
echo "2. Ve a GoHighLevel y configura la Redirect URI como:"
echo "   → $APP_URL/oauth/callback"
echo "3. Prueba la instalación de la app desde GoHighLevel"
echo "4. Debe redirigir a: $OAUTH_SUCCESS_URL sin bucles"
echo

echo "🎯 CONFIGURACIÓN EN GOHIGHLEVEL:"
echo "-------------------------------"
echo "Redirect URI: $APP_URL/oauth/callback"
echo "App Status: Debe estar en 'Published' o 'Live'"
echo

echo "🏗️ NUEVA ARQUITECTURA:"
echo "----------------------"
echo "1. Solicitud → /app/oauth-success"
echo "2. Nginx intercepta /app/*"
echo "3. Reescribe a /oauth-success"
echo "4. Next.js sirve la página"
echo "5. ✅ Usuario ve página de éxito"
echo

if [ "$HTTP_CODE" = "200" ]; then
    echo "🎉 VERIFICACIÓN EXITOSA - La solución radical funcionó"
    exit 0
elif [ "$HTTP_CODE" = "301" ] && [ "$LOCATION" = "$OAUTH_SUCCESS_URL" ]; then
    echo "💥 VERIFICACIÓN FALLIDA - El bucle de redirección persiste"
    echo "   Revisa la configuración de nginx y Next.js"
    exit 1
else
    echo "⚠️  VERIFICACIÓN PARCIAL - Revisa manualmente el comportamiento"
    exit 1
fi