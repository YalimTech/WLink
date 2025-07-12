# WLink Adapter

**WLink Adapter** es el microservicio principal que gestiona la integración entre WhatsApp (a través de Evolution API) y GoHighLevel, funcionando como el backend de una plataforma SaaS que permite a los usuarios conectar y administrar sus propias instancias de WhatsApp dentro de GoHighLevel.

> ⚠️ Este repositorio es privado y su contenido es propietario. No está disponible para uso público ni distribución.

---

## 📌 ¿Qué es WLink Adapter?

WLink Adapter actúa como un **puente inteligente** entre:

- 📱 **Evolution API v2** (gestión de WhatsApp en la nube)
- 🔗 **GoHighLevel** (plataforma CRM/marketing)
- ⚙️ Tu propio sistema SaaS para clientes y gestión de instancias

Este servicio permite:

- Crear y vincular instancias de WhatsApp a cuentas GHL
- Enviar y recibir mensajes desde GHL
- Controlar el estado y permisos de cada instancia
- Administrar eventos como Webhooks, autenticaciones y suscripciones

---

## ⚙️ Tecnologías utilizadas

- **NestJS** + **TypeScript**
- **Prisma ORM** + PostgreSQL
- **Docker** para despliegue
- **Evolution API v2**
- **GoHighLevel OAuth & Webhooks**
- Preparado para una estructura **SaaS escalable y multicliente**

---

## 🔒 Acceso y licenciamiento

Este repositorio es de uso interno. Ninguna parte de este código puede ser copiada, reutilizada o modificada fuera del alcance del proyecto autorizado.

### Licencia

**Private – All rights reserved.**

Para obtener una licencia comercial o consultar sobre colaboración, escríbenos a: `tucorreo@tudominio.com`.

---

## 🛠 Estado del desarrollo

✅ Gestión de tokens OAuth de GoHighLevel  
✅ Manejo de mensajes entrantes y salientes  
✅ Registro automático de contactos y conversaciones  
✅ Integración con Evolution API v2  
🔜 Panel de administración externo para clientes  
🔜 Módulo de suscripciones con PayPal  

---

## 📂 Estructura del proyecto

```bash
/src
  ├── ghl/              # Servicios y lógica de integración con GHL
  ├── evolution/        # Webhooks y conexión con Evolution API
  ├── prisma/           # Servicio Prisma ORM
  ├── oauth/            # Controladores de autenticación con GHL
  ├── webhooks/         # Recepción de eventos de GHL y Evolution
  ├── types.ts          # Tipos y estructuras compartidas
  ├── main.ts           # Bootstrap principal
```

---

## 🚀 Construcción del contenedor

Para instalar las dependencias privadas durante el build se utiliza un fichero `.npmrc` que requiere un token de autenticación. Es recomendable usar [Docker BuildKit](https://docs.docker.com/build/) para pasar el token como un *secret* y evitar que quede almacenado en la imagen.

1. Cree un token personal con permiso `read:packages` y defina la variable de entorno `NPM_TOKEN`.
2. Ejecute la construcción indicando el secreto:

```bash
NPM_TOKEN=xxxxxxxx docker compose build --secret id=npm_token,env=NPM_TOKEN
```
