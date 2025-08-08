#!/bin/bash

# Script de Verificación - Solución ERR_TOO_MANY_REDIRECTS
# Ejecutar después del deployment para verificar la configuración

echo "🔍 VERIFICANDO CONFIGURACIÓN DE OAUTH - WLINK"
echo "=============================================="
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

if [ -z "$FRONTEND_URL" ]; then
    echo "⚠️  WARNING: FRONTEND_URL no está configurada (usará APP_URL/app como fallback)"
else
    echo "✅ FRONTEND_URL: $FRONTEND_URL"
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

# Verificar endpoint OAuth
echo "🔐 4. VERIFICANDO ENDPOINT OAUTH:"
echo "---------------------------------"

# Verificar que el endpoint OAuth esté disponible
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL/oauth/callback" | grep -q "405\|400"; then
    echo "✅ Endpoint OAuth ($APP_URL/oauth/callback): Disponible"
else
    echo "❌ Endpoint OAuth ($APP_URL/oauth/callback): No disponible"
fi

echo

# Verificar página de éxito
echo "📄 5. VERIFICANDO PÁGINA DE ÉXITO:"
echo "----------------------------------"

EXPECTED_SUCCESS_URL="${FRONTEND_URL:-$APP_URL/app}/oauth-success"
if curl -s -o /dev/null -w "%{http_code}" "$EXPECTED_SUCCESS_URL" | grep -q "200"; then
    echo "✅ Página de éxito ($EXPECTED_SUCCESS_URL): Disponible"
else
    echo "❌ Página de éxito ($EXPECTED_SUCCESS_URL): No disponible"
fi

echo

# Instrucciones finales
echo "📝 PRÓXIMOS PASOS:"
echo "------------------"
echo "1. Asegúrate de que todas las verificaciones muestren ✅"
echo "2. Ve a GoHighLevel y configura la Redirect URI como:"
echo "   → $APP_URL/oauth/callback"
echo "3. Prueba la instalación de la app desde GoHighLevel"
echo "4. Debe redirigir a: $EXPECTED_SUCCESS_URL"
echo

echo "🎯 CONFIGURACIÓN EN GOHIGHLEVEL:"
echo "-------------------------------"
echo "Redirect URI: $APP_URL/oauth/callback"
echo "App Status: Debe estar en 'Published' o 'Live'"
echo

echo "📞 SOPORTE:"
echo "-----------"
echo "Si algo no funciona, proporciona:"
echo "- Output de este script"
echo "- Logs del backend con '[OAuth Callback]'"
echo "- Screenshot del error en el navegador"
echo

if [ -z "$FRONTEND_URL" ] || [ -z "$APP_URL" ]; then
    echo "⚠️  ADVERTENCIA: Verifica que todas las variables estén configuradas"
    exit 1
else
    echo "✅ VERIFICACIÓN COMPLETADA - La configuración parece correcta"
fi