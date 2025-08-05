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
FROM node:20-alpine

# NGINX
RUN apk add --no-cache nginx supervisor
RUN npm install -g pnpm
WORKDIR /app

# Copiamos backend compilado
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY --from=build-backend /app/backend/package.json ./backend/package.json
COPY --from=build-backend /app/backend/node_modules ./backend/node_modules
COPY --from=build-backend /app/backend/prisma ./backend/prisma

# Copiamos frontend compilado y públicos (para Next runtime)
WORKDIR /app/frontend
COPY --from=build-frontend /app/frontend/.next ./.next
COPY --from=build-frontend /app/frontend/public ./public
COPY --from=build-frontend /app/frontend/package.json ./package.json
COPY --from=build-frontend /app/frontend/package-lock.json ./package-lock.json
RUN npm install --omit=dev

# NGINX + Supervisor
WORKDIR /app
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY supervisord/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /var/log/nginx && touch /var/log/nginx/access.log /var/log/nginx/error.log

EXPOSE 3000
CMD ["/usr/bin/supervisord","-c","/etc/supervisor/conf.d/supervisord.conf"]
