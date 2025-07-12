FROM node:20-alpine

WORKDIR /app

ARG NPM_TOKEN
COPY .npmrc .npmrc

COPY package.json ./
COPY package-lock.json ./

RUN npm install && rm -f .npmrc

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
