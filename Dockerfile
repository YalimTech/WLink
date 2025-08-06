
# Stage 1: Backend Builder
FROM node:20-alpine AS backend-builder
WORKDIR /usr/src/app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --cache /tmp/.npm
COPY backend/prisma ./prisma/
COPY backend/src ./src/
COPY backend/nest-cli.json backend/tsconfig.build.json backend/tsconfig.json ./
RUN npx prisma generate
RUN npm run build && npm prune --production

# Stage 2: Frontend Builder
FROM node:20-alpine AS frontend-builder
WORKDIR /usr/src/app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --cache /tmp/.npm
COPY frontend/next.config.mjs frontend/postcss.config.js frontend/tailwind.config.js frontend/tsconfig.json ./
COPY frontend/public ./public/
COPY frontend/src ./src/
RUN npm run build

# Stage 3: Production Dependencies
FROM node:20-alpine AS prod-deps
WORKDIR /usr/src/app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev --cache /tmp/.npm
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --omit=dev --cache /tmp/.npm

# Stage 4: Final Stage
FROM alpine:latest
WORKDIR /usr/src/app

# Instala NGINX, Supervisor, Node.js/npm y OpenSSL (para certificados SSL)
RUN apk add --no-cache nginx supervisor nodejs npm openssl && \
    rm -rf /var/cache/apk/*

# Genera certificados SSL autofirmados para desarrollo/testing
RUN mkdir -p /etc/ssl/certs /etc/ssl/private && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" && \
    rm -rf /tmp/*

# Copia la configuración de NGINX
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copia la configuración de Supervisor
COPY supervisord/supervisord.conf /etc/supervisord.conf

# Copia los artefactos del backend (solo lo necesario)
COPY --from=backend-builder /usr/src/app/backend/dist ./backend/dist
COPY --from=prod-deps /usr/src/app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /usr/src/app/backend/package.json ./backend/package.json
COPY --from=backend-builder /usr/src/app/backend/prisma ./backend/prisma

# Copia los artefactos del frontend (solo lo necesario para producción)
COPY --from=frontend-builder /usr/src/app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /usr/src/app/frontend/public ./frontend/public
COPY --from=frontend-builder /usr/src/app/frontend/package.json ./frontend/package.json
# Solo copia node_modules de producción para Next.js
COPY --from=prod-deps /usr/src/app/frontend/node_modules ./frontend/node_modules

# Expone los puertos 80 (HTTP) y 443 (HTTPS)
EXPOSE 80 443

# Comando para ejecutar supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
