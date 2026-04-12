# Build context: monorepo root (aegis-marine-ai/)
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests first for layer-cache efficiency
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY apps/api/ ./apps/api/
WORKDIR /app/apps/api
RUN pnpm build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV NODE_ENV=production
# Cloud Run injects PORT (default 8080); fallback to 3001 for local docker
EXPOSE 8080

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
