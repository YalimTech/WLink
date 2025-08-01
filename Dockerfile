# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build
FROM node:20-alpine AS build-backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
COPY backend/nest-cli.json ./
COPY backend/tsconfig.json ./
COPY backend/tsconfig.build.json ./
COPY backend/src/ ./src/
COPY backend/prisma/ ./prisma/
RUN npm install
RUN npx prisma generate
RUN npm run build
FROM node:20-alpine
RUN apk add --no-cache nginx supervisor
WORKDIR /app
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY --from=build-frontend /app/frontend/public ./backend/dist/public
COPY --from=build-frontend /app/frontend/.next ./backend/dist/public/_next
COPY backend/package.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev
COPY --from=build-backend /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY supervisord/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN mkdir -p /var/log/nginx && touch /var/log/nginx/access.log /var/log/nginx/error.log
WORKDIR /app
EXPOSE 3000
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
