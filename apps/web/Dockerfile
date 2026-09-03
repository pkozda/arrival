# syntax=docker/dockerfile:1

# Arrival Atlas Web — production Next.js image (npm workspaces monorepo).
# Build context: repository root.
#
# NEXT_PUBLIC_API_URL is baked at build time.
# For same-origin Caddy routing (/api → API), leave it empty so the browser
# calls relative "/api/..." URLs (see docs/deployment.md).

FROM node:20-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

# Empty string = same-origin relative API base (NOT the localhost default).
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm ci

# Packages that Next transpilePackages / workspace imports may need built.
RUN npm run build -w @arrival-atlas/ui-contract \
  && npm run build -w @arrival-atlas/core \
  && npm run build -w @arrival-atlas/profile \
  && npm run build -w @arrival-atlas/shared-services \
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
  && npm run build -w @arrival-atlas/web

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3000

# Bind all interfaces so Caddy can reach the container.
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
