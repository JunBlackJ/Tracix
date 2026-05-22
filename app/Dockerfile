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

CMD sh -c 'echo ":${PORT}" > /etc/caddy/Caddyfile && \
    echo "root * /srv" >> /etc/caddy/Caddyfile && \
    echo "try_files {path} /index.html" >> /etc/caddy/Caddyfile && \
    echo "file_server" >> /etc/caddy/Caddyfile && \
    caddy run --config /etc/caddy/Caddyfile --adapter caddyfile'
