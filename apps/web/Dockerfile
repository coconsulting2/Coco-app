# syntax=docker/dockerfile:1.7
#
# coco-app — unified React Router v7 framework mode app (front + back en un solo proceso).
#
# Multi-target Dockerfile:
#
#   target=deps         used by docker-compose.dev.yml — source is bind-mounted in,
#                       this image provides bun + real Node + node_modules + Prisma
#                       client. `bun run dev` (= react-router dev) runs against the
#                       host source for hot-reload.
#
#   target=production   used by docker-compose.yml and the GHCR publish workflow —
#                       fully self-contained build: react-router build → static client
#                       bundle + Node SSR server. HTTPS certs auto-generated on first
#                       start. Single port (5173).
#
# Reemplaza la pareja {TC3005B.501-Backend/Dockerfile, TC3005B.501-Frontend/Dockerfile}
# legacy. La imagen sirve TODO: API resource routes + SSR pages + asset serving.

# ============================================================
# Base — bun + real Node 22 + openssl/curl/ca-certs
# oven/bun:1-slim ships only a bun shim for `node`, which fails to load native
# modules like bcrypt and the Prisma engine; we need real Node from NodeSource.
# ============================================================
FROM oven/bun:1 AS base
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && bun --version

# Bake the openssl config + cert generation script at a stable path so they're
# reachable from both production (where /app/certs is part of the image) and dev
# (where /app/certs is a named volume that hides anything baked at that path).
COPY docker/openssl.cnf.template /opt/openssl.cnf.template
COPY certs/create_certs.sh /opt/create_certs.sh
# Strip CR in case the host repo was cloned on Windows with core.autocrlf=true.
RUN tr -d '\r' < /opt/create_certs.sh > /opt/create_certs.tmp && mv /opt/create_certs.tmp /opt/create_certs.sh \
    && tr -d '\r' < /opt/openssl.cnf.template > /opt/openssl.cnf.tmp && mv /opt/openssl.cnf.tmp /opt/openssl.cnf.template \
    && chmod +x /opt/create_certs.sh

# ============================================================
# deps — install dependencies + generate Prisma client.
# Cypress binary skipped to shave ~150MB (we don't run cypress inside the app
# container; cypress runs on the host or in a dedicated test container).
# ============================================================
FROM base AS deps
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN CYPRESS_INSTALL_BINARY=0 bun install --frozen-lockfile
RUN bunx prisma generate

# ============================================================
# build — react-router build (client + server bundles).
# Output: ./build/{client,server}
# ============================================================
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate \
    && bun run build

# ============================================================
# production — slim runtime serving the standalone RR v7 build.
# Includes Prisma engine + node_modules pruned to production only.
# ============================================================
FROM base AS production
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5173

# Bring in built artifacts + node_modules + Prisma client + everything Prisma needs at runtime.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/openapi ./openapi

# Cert + entrypoint scripts. /opt copies survive even if /app/certs is mounted as volume.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN mkdir -p /app/certs \
    && cp /opt/create_certs.sh /app/certs/create_certs.sh \
    && cp /opt/openssl.cnf.template /app/certs/openssl.cnf \
    && tr -d '\r' < /usr/local/bin/entrypoint.sh > /usr/local/bin/entrypoint.tmp && mv /usr/local/bin/entrypoint.tmp /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh /app/certs/create_certs.sh

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fk https://localhost:5173/login || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bunx", "react-router-serve", "./build/server/index.js"]
