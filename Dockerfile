# syntax=docker/dockerfile:1.7
#
# coco-app: monorepo bun workspaces (apps/web + packages/*).
#
# Build stages:
#   deps     → instala bun + dependencias del workspace + genera Prisma client.
#              Usado por docker-compose.dev.yml para hot-reload (bind-mount source).
#   build    → produce `apps/web/build/` para producción.
#   runtime  → imagen final mínima con bun + el build output + entrypoint.

# ────────────────────────────────────────────────────────────────────────────
# Stage: deps
#   Base con bun + openssl + dependencias del workspace instaladas.
# ────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1.2.21 AS deps

# openssl + curl + ca-certs (la base oven/bun viene con debian-slim).
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cert tooling baked into image (entrypoint copia de /opt al volumen).
COPY docker/openssl.cnf.template /opt/openssl.cnf.template
COPY docker/create_certs.sh      /opt/create_certs.sh
COPY docker/entrypoint.sh        /usr/local/bin/entrypoint.sh
RUN chmod +x /opt/create_certs.sh /usr/local/bin/entrypoint.sh

# Manifests + lockfile primero para aprovechar layer caching.
COPY package.json bun.lock tsconfig.base.json tsconfig.json ./
COPY apps/web/package.json              apps/web/package.json
COPY packages/db/package.json             packages/db/package.json
COPY packages/contracts/package.json      packages/contracts/package.json
COPY packages/integrations/package.json   packages/integrations/package.json
COPY packages/scheduler/package.json      packages/scheduler/package.json
COPY packages/shared-config/package.json  packages/shared-config/package.json
COPY packages/ui-kit/package.json         packages/ui-kit/package.json

RUN bun install --frozen-lockfile

# Resto del source.
COPY apps      apps
COPY packages  packages
COPY docker    docker

# Genera Prisma client (apunta a packages/db/prisma/schema.prisma).
RUN cd packages/db && bunx prisma generate

# Directorio para certs HTTPS (named volume en compose).
RUN mkdir -p /app/certs && cp /opt/openssl.cnf.template /app/certs/openssl.cnf

EXPOSE 5173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "run", "--filter", "@coco/web", "dev"]

# ────────────────────────────────────────────────────────────────────────────
# Stage: build  (production-only)
# ────────────────────────────────────────────────────────────────────────────
FROM deps AS build

ENV NODE_ENV=production
RUN bun run --filter @coco/web build

# ────────────────────────────────────────────────────────────────────────────
# Stage: runtime (final production image)
# ────────────────────────────────────────────────────────────────────────────
FROM oven/bun:1.2.21 AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /opt/openssl.cnf.template       /opt/openssl.cnf.template
COPY --from=build /opt/create_certs.sh            /opt/create_certs.sh
COPY --from=build /usr/local/bin/entrypoint.sh    /usr/local/bin/entrypoint.sh

# Copia node_modules, build output y meta del workspace.
COPY --from=build /app/node_modules               ./node_modules
COPY --from=build /app/apps/web/build             ./apps/web/build
COPY --from=build /app/apps/web/package.json      ./apps/web/package.json
COPY --from=build /app/package.json               ./package.json
COPY --from=build /app/bun.lock                   ./bun.lock
COPY --from=build /app/packages                   ./packages

RUN mkdir -p /app/certs

ENV NODE_ENV=production
EXPOSE 5173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "run", "--filter", "@coco/web", "start"]
