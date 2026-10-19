FROM node:24.15.0-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.15.0-alpine AS runner
WORKDIR /app

RUN apk upgrade --no-cache
RUN apk add --no-cache smartmontools

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
VOLUME /app/config
ENV NODE_ENV=production
ENV CONFIG_DIR=/app/config

# Unhealthy when the server stops answering or the config folder is not writable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

CMD ["node", "build"]