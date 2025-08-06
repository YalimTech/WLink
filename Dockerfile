# syntax=docker/dockerfile:1.4

# --- build de frontend ---
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- build de backend ---
FROM node:20-alpine AS build-backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# --- imagen final ---
# Stage 3: Final image
FROM node:18-alpine
# Crea el directorio de trabajo principal
WORKDIR /usr/src/app
# Instala NGINX y Supervisor
RUN apk add --no-cache nginx supervisor
# ---- Configuración del Backend ----
# Crea el directorio para el backend
RUN mkdir -p /usr/src/app/backend
WORKDIR /usr/src/app/backend
# Copia los archivos compilados del backend
COPY --from=build-backend /usr/src/app/dist /dist
COPY --from=build-backend /usr/src/app/node_modules /node_modules
COPY --from=build-backend /usr/src/app/package*json /
# ---- Configuración del Frontend ----
# Crea el directorio para el frontend
RUN mkdir -p /usr/src/app/frontend
WORKDIR /usr/src/app/frontend
# Copia los archivos compilados del frontend
COPY --from=build-frontend /app/frontend/.next /next
COPY --from=build-frontend /app/frontend/public /public
COPY --from=build-frontend /app/frontend/package*json /
COPY --from=build-frontend /app/frontend/next.config.mjs /
# ---- Configuración de Servidores ----
# Vuelve al directorio principal para copiar las configuraciones
WORKDIR /usr/src/app
# Copia las configuraciones de NGINX y Supervisor
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY supervisord/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
# Expone el puerto 80
EXPOSE 80
# Comando final para iniciar Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/confd/supervisord.conf"]
