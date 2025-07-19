# WLink Bridge

## Introducción
WLink Bridge es un servicio que conecta Evolution API con GoHighLevel. La integración requiere diversas variables de entorno, incluida `EVOLUTION_CONSOLE_URL` para apuntar a la consola de Evolution. Las variables `EVOLUTION_API_URL` y `EVOLUTION_WEBHOOK_SECRET` deben estar definidas antes de iniciar la aplicación o ésta generará un error. Consulta `.env.example` para ver la lista completa de variables.

Todas las IDs de instancia se almacenan como cadenas para adecuarse al esquema de Prisma. Las funciones auxiliares convierten los identificadores numéricos en cadenas antes de las consultas a la base de datos. Al conectar una nueva instancia de Evolution es necesario proporcionar el `instanceId` junto con el token de API. El servicio valida estas credenciales antes de guardarlas.


## Configuración
1. Copia el archivo `.env.example` a `.env` y ajusta los valores.
2. Instala las dependencias:

```bash
npm install
```

3. Compila el proyecto y ejecuta las pruebas:

```bash
npm run build
npm test
```

## Uso básico
Durante el desarrollo inicia el servicio con:

```bash
npm run start:dev
```

Para producción o contenedores utiliza:

```bash
npm run start
# o
docker-compose up
```
