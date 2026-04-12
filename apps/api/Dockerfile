# Build context: monorepo root
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests first for layer-cache efficiency
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Build API
COPY apps/api/ ./apps/api/
WORKDIR /app/apps/api
RUN pnpm build

# Build Web (VITE_API_URL empty = relative URLs, same origin)
WORKDIR /app/apps/web
COPY apps/web/ .
RUN pnpm build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --prod

# Copy compiled API
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy built frontend into a known location the API will serve
COPY --from=builder /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production
# Cloud Run injects PORT (default 8080)
EXPOSE 8080

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
