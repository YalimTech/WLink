# syntax=docker/dockerfile:14
# --- Etapa 1: Build de frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /usr/src/app
COPY frontend/package*json /
RUN npm install
COPY frontend/ /
RUN npm run build
# --- Etapa 2: Build de backend ---
FROM node:20-alpine AS backend-builder
WORKDIR /usr/src/app
COPY backend/package*json /
RUN npm ci
COPY backend/prisma /prisma
RUN npx prisma generate
COPY backend/ /
RUN npm run build
# --- Etapa 3: Imagen final ---
FROM node:18-alpine
# Instala NGINX y Supervisor
RUN apk add --no-cache nginx supervisor
# Establece el directorio de trabajo principal
WORKDIR /usr/src/app
# ---- Copia el Backend ----
COPY --from=backend-builder /usr/src/app/dist /dist
COPY --from=backend-builder /usr/src/app/node_modules /node_modules
COPY --from=backend-builder /usr/src/app/package*json /
COPY --from=backend-builder /usr/src/app/prisma /prisma
# ---- Copia el Frontend ----
COPY --from=frontend-builder /usr/src/app/next /next
COPY --from=frontend-builder /usr/src/app/public /public
COPY --from=frontend-builder /usr/src/app/packagejson /packagejson
COPY --from=frontend-builder /usr/src/app/nextconfigmjs /nextconfigmjs
# ---- Copia las configuraciones de Servidores ----
COPY nginx/nginxconf /etc/nginx/nginxconf
COPY supervisord/supervisordconf /etc/supervisor/confd/supervisordconf
# Crea los directorios de logs para NGINX
RUN mkdir -p /var/log/nginx && touch /var/log/nginx/accesslog /var/log/nginx/errorlog
# Expone el puerto 80 (el que usará NGINX)
EXPOSE 80
# Comando final para iniciar Supervisor, que gestionará todos los servicios
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/confd/supervisordconf"]