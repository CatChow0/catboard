FROM node:24.15.0-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules (systeminformation)
RUN apk add --no-cache python3 make g++

# Update npm to fix bundled dependency vulnerabilities (picomatch, brace-expansion)
RUN npm install -g npm@latest

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

FROM node:24.15.0-alpine AS runner
WORKDIR /app

# Upgrade Alpine packages to fix OS-level vulnerabilities (busybox, etc.)
RUN apk upgrade --no-cache

# Update npm to fix bundled dependency vulnerabilities (picomatch, brace-expansion)
RUN npm install -g npm@latest

# Install runtime dependencies for systeminformation on Alpine
# smartmontools: optional, enables S.M.A.R.T. disk details
RUN apk add --no-cache smartmontools

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
VOLUME /app/config
ENV NODE_ENV=production
ENV CONFIG_DIR=/app/config

CMD ["node", "build"]