# syntax=docker/dockerfile:1

# Arrival Atlas API — production image (npm workspaces monorepo).
# Build context: repository root.
# Native module: better-sqlite3 (Debian bookworm, not Alpine).

FROM node:20-bookworm AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

# Build workspace packages required by @arrival-atlas/api (exclude web).
RUN npm run build -w @arrival-atlas/ui-contract \
  && npm run build -w @arrival-atlas/core \
  && npm run build -w @arrival-atlas/profile \
  && npm run build -w @arrival-atlas/shared-services \
  && npm run build -w @arrival-atlas/discovery \
  && npm run build -w @arrival-atlas/module-sdk \
  && npm run build -w @arrival-atlas/module-runtime \
  && npm run build -w @arrival-atlas/product-contract \
  && npm run build -w @arrival-atlas/mbde \
  && npm run build -w @arrival-atlas/profile-engine \
  && npm run build -w @arrival-atlas/profile-intelligence \
  && npm run build -w @arrival-atlas/observability \
  && npm run build -w @arrival-atlas/modules \
  && npm run build -w @arrival-atlas/life-event-demo \
  && npm run build -w @arrival-atlas/ux \
  && npm run build -w @arrival-atlas/api

FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    ARRIVAL_ATLAS_DEV_TOOLS=false \
    ARRIVAL_ATLAS_STATE_DIR=/data/state \
    ARRIVAL_ATLAS_ACCOUNTS_DIR=/data/accounts \
    ARRIVAL_ATLAS_SESSIONS_DIR=/data/sessions \
    ARRIVAL_ATLAS_ENTITLEMENTS_DIR=/data/entitlements

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY deploy/api-entrypoint.sh /app/api-entrypoint.sh

RUN chmod +x /app/api-entrypoint.sh \
  && mkdir -p /data/state /data/accounts /data/sessions /data/entitlements

WORKDIR /app/apps/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

ENTRYPOINT ["/app/api-entrypoint.sh"]
CMD ["node", "dist/index.js"]
