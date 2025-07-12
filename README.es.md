WLink Adapter
WLink Adapter es el microservicio principal que gestiona la integración entre WhatsApp (a través de Evolution API) y GoHighLevel, funcionando como el backend de una plataforma SaaS que permite a los usuarios conectar y administrar sus propias instancias de WhatsApp dentro de GoHighLevel.

⚠️ Este repositorio es privado y su contenido es propietario. No está disponible para uso público ni distribución.

📌 ¿Qué es WLink Adapter?
WLink Adapter actúa como un puente inteligente entre:

📱 Evolution API v2 (gestión de WhatsApp en la nube)
🔗 GoHighLevel (plataforma CRM/marketing)
⚙️ Tu propio sistema SaaS para clientes y gestión de instancias
Este servicio permite:

Crear y vincular instancias de WhatsApp a cuentas GHL
Enviar y recibir mensajes desde GHL
Controlar el estado y permisos de cada instancia
Administrar eventos como Webhooks, autenticaciones y suscripciones
⚙️ Tecnologías utilizadas
NestJS + TypeScript
Prisma ORM + PostgreSQL
Docker para despliegue
Evolution API v2
GoHighLevel OAuth & Webhooks
Preparado para una estructura SaaS escalable y multicliente
🔒 Acceso y licenciamiento
Este repositorio es de uso interno. Ninguna parte de este código puede ser copiada, reutilizada o modificada fuera del alcance del proyecto autorizado.

Licencia
Private – All rights reserved.

Para obtener una licencia comercial o consultar sobre colaboración, escríbenos a: tucorreo@tudominio.com.

🔁 Sincronización de conversaciones
WLink Bridge mantiene un único hilo por cliente en GoHighLevel donde se integran todos los mensajes de WhatsApp. Cada location puede gestionar varios números a la vez y distinguirlos por su avatar.

💳 Suscripciones flexibles
Las instancias se contratan por periodos mensuales o mayores. El administrador define precios y descuentos y el pago se realiza con PayPal. Al expirar la suscripción las instancias se desactivan hasta renovarla.

🛠 Estado del desarrollo
✅ Gestión de tokens OAuth de GoHighLevel
✅ Manejo de mensajes entrantes y salientes
✅ Registro automático de contactos y conversaciones
✅ Integración con Evolution API v2
🔜 Panel de administración externo para clientes
🔜 Módulo de suscripciones con PayPal

📂 Estructura del proyecto
/src
  ├── ghl/              # Servicios y lógica de integración con GHL
  ├── evolution/        # Webhooks y conexión con Evolution API
  ├── prisma/           # Servicio Prisma ORM
  ├── oauth/            # Controladores de autenticación con GHL
  ├── webhooks/         # Recepción de eventos de GHL y Evolution
  ├── types.ts          # Tipos y estructuras compartidas
  ├── main.ts           # Bootstrap principal
🚀 Construcción del contenedor
Para instalar las dependencias privadas durante el build se utiliza un fichero .npmrc que requiere un token de autenticación. Es recomendable usar Docker BuildKit para pasar el token como un secret y evitar que quede almacenado en la imagen.

Cree un token personal con permiso read:packages y defina la variable de entorno NPM_TOKEN.
Ejecute la construcción indicando el secreto:
NPM_TOKEN=xxxxxxxx docker compose build --secret id=npm_token,env=NPM_TOKEN
Si no cuenta con acceso a los paquetes privados, puede omitir la variable NPM_TOKEN y la construcción seguirá adelante utilizando únicamente las dependencias públicas.

Generar Prisma Client sin conexión
Si el entorno bloquea la descarga de binarios de Prisma, defina PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 antes de ejecutar npx prisma generate para omitir la verificación de suma.

### Configuración del entorno
Copie el archivo `.env.example` a `.env` y defina la variable `DATABASE_URL` con su cadena de conexión de PostgreSQL.
Si usa `docker-compose`, evite poner comillas alrededor de la URL para que la variable se expanda correctamente.
La URL debe comenzar con `postgresql://` o `postgres://` conforme a la [documentación de Prisma](https://www.prisma.io/docs/orm/prisma-schema#datasource). Además configure `EVOLUTION_API_URL` con la ruta base de Evolution API v2 y ajuste las demás variables siguiendo sus credenciales de GoHighLevel y Evolution API.
