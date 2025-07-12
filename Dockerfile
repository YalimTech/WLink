# syntax=docker/dockerfile:1.4
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY .npmrc .npmrc

RUN --mount=type=secret,id=npm_token,required=false \
    if [ -f /run/secrets/npm_token ]; then \
        export NPM_TOKEN=$(cat /run/secrets/npm_token); \
    else \
        rm -f .npmrc; \
    fi && \
    npm install && rm -f .npmrc

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
