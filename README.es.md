# WLink Bridge

## Introducción
WLink Bridge es un servicio que conecta Evolution API con GoHighLevel. La integración requiere diversas variables de entorno, incluida `EVOLUTION_CONSOLE_URL` para apuntar a la consola de Evolution. Consulta `.env.example` para ver la lista completa de variables.

Todas las IDs de instancia se almacenan como cadenas para adecuarse al esquema de Prisma. Cuando agregues una nueva instancia de Evolution debes indicar su **nombre de instancia** tal como aparece en la consola de Evolution. El servicio obtendrá automáticamente su ID antes de guardarla.

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
