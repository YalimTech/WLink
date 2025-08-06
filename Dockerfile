
# Stage 1: Backend Builder
FROM node:20-alpine AS backend-builder
WORKDIR /usr/src/app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/prisma ./prisma/
COPY backend/src ./src/
COPY backend/nest-cli.json backend/tsconfig.build.json backend/tsconfig.json ./
RUN npx prisma generate
RUN npm run build

# Stage 2: Frontend Builder
FROM node:20-alpine AS frontend-builder
WORKDIR /usr/src/app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/next.config.mjs frontend/postcss.config.js frontend/tailwind.config.js frontend/tsconfig.json ./
COPY frontend/public ./public/
COPY frontend/src ./src/
RUN npm run build

# Stage 3: Final Stage
FROM alpine:latest
WORKDIR /usr/src/app

# Instala NGINX, Supervisor y Node.js/npm (para ejecutar las apps)
RUN apk add --no-cache nginx supervisor nodejs npm

# Copia la configuración de NGINX
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copia la configuración de Supervisor
COPY supervisord/supervisord.conf /etc/supervisord.conf

# Copia los artefactos del backend
COPY --from=backend-builder /usr/src/app/backend/dist ./backend/dist
COPY --from=backend-builder /usr/src/app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /usr/src/app/backend/package.json ./backend/package.json
COPY --from=backend-builder /usr/src/app/backend/prisma ./backend/prisma

# Copia los artefactos del frontend
COPY --from=frontend-builder /usr/src/app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /usr/src/app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /usr/src/app/frontend/package.json ./frontend/package.json
COPY --from=frontend-builder /usr/src/app/frontend/public ./frontend/public

# Expone el puerto 80 (NGINX)
EXPOSE 80

# Comando para ejecutar supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
