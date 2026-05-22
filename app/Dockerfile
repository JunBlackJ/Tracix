FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

FROM caddy:2-alpine

COPY --from=builder /app/dist /srv

RUN printf ':${PORT:-3000}\nroot * /srv\ntry_files {path} /index.html\nfile_server\n' > /etc/caddy/Caddyfile

EXPOSE 3000

CMD caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
