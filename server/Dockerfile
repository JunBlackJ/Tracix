FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN node node_modules/typescript/bin/tsc
RUN node node_modules/.bin/prisma generate

EXPOSE 4000

CMD ["sh", "-c", "node node_modules/.bin/prisma db push --accept-data-loss && node dist/index.js"]
