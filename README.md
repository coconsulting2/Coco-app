# coco-app

Sistema de gestión de viajes corporativos de CocoConsulting: solicitudes de
viaje, flujos de autorización N1/N2, cotización con agencia, comprobación de
gastos (CFDI/SAT), exportación contable y reembolsos.

Unifica los antiguos `TC3005B.501-Backend` (Express) y `TC3005B.501-Frontend`
(Astro) en una sola aplicación **React Router v7 (framework mode, SSR)** sobre
un **monorepo de bun workspaces**, con **arquitectura hexagonal** por bounded
context y **multi-tenant con Row-Level Security** en PostgreSQL.

## Stack

- **Runtime / gestor de paquetes:** Bun (workspaces). No usar npm/pnpm.
- **App web:** React 19 + React Router v7 SSR + Tailwind CSS v4 (TypeScript estricto).
- **Base de datos:** PostgreSQL + Prisma, con RLS multi-tenant.
- **Almacenamiento de archivos:** MongoDB GridFS o S3/R2 (seleccionable por `FILE_STORE_DRIVER`).
- **Integraciones:** Duffel (vuelos/hoteles), SAT (validación CFDI por SOAP), Wise (pagos), Banxico (FX).
- **Tests:** Vitest (unit/integración) + Cypress (E2E).

## Layout del monorepo

```
coco-app/
├── apps/
│   └── web/                    @coco/web — aplicación React Router v7 SSR
│       ├── app/
│       │   ├── platform/       capa horizontal: db/RLS, sesión/JWT, CSRF, permisos, mongo, s3, mail, push, scheduler
│       │   ├── contexts/       16 bounded contexts hexagonales (domain / application / infrastructure / interface)
│       │   ├── shared/         UI con dominio, layouts, hooks, utils, types
│       │   └── routes/         rutas RR7 (_public, _app, api)
│       ├── openapi/            contratos OpenAPI
│       ├── cypress/            specs E2E
│       └── tests/              specs Vitest
└── packages/
    ├── db/                     @coco/db — Prisma, cliente, RLS, tenant context, migraciones y seeds
    ├── contracts/              @coco/contracts — tipos TypeScript generados desde OpenAPI
    ├── integrations/           @coco/integrations — Duffel, SAT
    ├── scheduler/              @coco/scheduler — workers cron (proceso separado)
    └── ui-kit/                 @coco/ui-kit — átomos de UI sin dominio
```

Detalle de arquitectura, reglas de capas y patrón de slice: ver `ARCHITECTURE.md`
y `CONTRIBUTING.md`.

## Prerrequisitos

- **Bun** >= 1.1.0
- **Docker** + Docker Compose (recomendado para el stack de desarrollo)
- Alternativa sin Docker: **PostgreSQL** y **MongoDB** locales

## Puesta en marcha

### Opción A — Stack de desarrollo con Docker (recomendado)

Levanta PostgreSQL, MongoDB, MinIO (emulación S3), aplica migraciones y arranca
la app con hot-reload en un solo comando.

```bash
cp .env.example .env          # completar secrets (ver sección Variables de entorno)
bun install
bun run docker:dev            # postgres + mongo + minio + migrate + app (HTTPS :5173)
```

Servicios y puertos del stack dev:

| Servicio   | Puerto host | Notas |
|------------|-------------|-------|
| app        | 5173        | `https://localhost:5173` (certificado self-signed, aceptar en el navegador) |
| postgres   | 5434        | mapeado a 5432 del contenedor (evita choque con Postgres nativo) |
| mongo      | 27017       | almacenamiento GridFS |
| minio API  | 9000        | endpoint S3-compatible |
| minio web  | 9001        | consola (`minioadmin` / `minioadmin`) |
| localstack | 4566        | mock S3 alternativo (heredado) |

Comandos relacionados:

```bash
bun run docker:dev:build      # reconstruye imágenes
bun run docker:dev:down       # detiene el stack
bun run docker:dev:clean      # detiene y borra volúmenes (reset total)
```

### Opción B — Local sin Docker

Requiere PostgreSQL y MongoDB corriendo en el host.

```bash
cp .env.example .env          # apuntar DATABASE_URL y MONGO_URI a los servicios locales
bun install
bun run db:generate           # prisma generate
bun run db:migrate            # aplica migraciones (prisma migrate dev)
bun run db:seed:dummy         # carga datos de ejemplo
bun run dev                   # arranca la app en https://localhost:5173
```

Tras arrancar, abrir `https://localhost:5173/login` y aceptar el certificado
self-signed. Las credenciales de prueba provienen del seed (ver `packages/db/prisma`).

## Variables de entorno

Copiar `.env.example` a `.env`. Variables principales (nombres, sin valores):

- **Base de datos y sesión:** `DATABASE_URL`, `MONGO_URI`, `JWT_SECRET`,
  `SESSION_SECRET`, `AES_SECRET_KEY`, `SESSION_COOKIE_NAME`, `CSRF_COOKIE_NAME`,
  `SESSION_MAX_AGE_DAYS`.
- **Almacenamiento de archivos:** `FILE_STORE_DRIVER` (`gridfs` por defecto, o `s3`),
  y para S3/MinIO/R2: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.
- **Integraciones:** `DUFFEL_ACCESS_TOKEN`, `FLIGHT_PROVIDER`, `HOTEL_PROVIDER`,
  `SAT_WSDL_URL`, `SAT_REQUEST_TIMEOUT_MS`, `BANXICO_API_KEY`, `BMX_API_URL`,
  `WISE_CLIENT_ID`, `WISE_CLIENT_SECRET` (+ rutas de certificados Wise),
  `MAIL_USER`, `MAIL_PASSWORD`.
- **Notificaciones push:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO`.
- **API externa / cifrado de chat:** `API_KEY_HASH_PEPPER`, `CHAT_MESSAGE_SECRET`,
  `CHAT_CURSOR_SECRET`.
- **Bootstrap tenant raíz:** `DITTA_RFC`, `DITTA_ADMIN_INITIAL_PASSWORD`.
- **Runtime / flags:** `NODE_ENV`, `PORT`, `SCHEDULER_ENABLED`, `MOCK_AUTH`,
  `JWT_SKIP_IP_CHECK`, `PRISMA_DISABLE_TRIGGERS`.
- **Cypress (E2E):** `CYPRESS_BASE_URL` y los pares `CYPRESS_<ROL>_USER/PASSWORD`.

`.env` y los certificados de `certs/` están en `.gitignore` y no se versionan.

## Comandos

```bash
# Desarrollo
bun run dev                   # app en HTTPS :5173 (front + back en el mismo proceso)
bun run build                 # build de producción
bun run start                 # sirve el build de producción
bun run scheduler:dev         # worker de cron (proceso separado)

# Calidad
bun run typecheck             # tsc -b en todo el workspace
bun run lint                  # ESLint (incluye reglas estructurales de capas)
bun run lint:fix              # ESLint con auto-fix
bun run test                  # Vitest (unit + integración)
bun --filter @coco/web test:e2e        # Cypress headless
bun --filter @coco/web test:e2e:open   # Cypress interactivo

# Base de datos (Prisma, vía @coco/db)
bun run db:generate           # prisma generate
bun run db:migrate            # prisma migrate dev
bun run db:studio             # Prisma Studio
bun run db:seed               # seed base
bun run db:seed:dummy         # seed con datos de ejemplo
bun run db:reset              # reset total + seed dummy
bun run db:seed:orgs          # seed de organizaciones

# Contratos
bun run contracts:generate    # regenera tipos TS desde OpenAPI

# Docker
bun run docker:dev            # stack de desarrollo
bun run docker:prod           # stack de producción
```

## Arquitectura (resumen)

- **Hexagonal por slice:** cada bounded context en `app/contexts/<slice>/` separa
  `domain/` (entidades + puertos), `application/` (casos de uso con inyección de
  dependencias), `infrastructure/` (adaptadores Prisma/integraciones) e
  `interface/` (dispatchers de API).
- **Datos por loader/action:** las rutas y los componentes de `shared/ui` no hacen
  `fetch` a `/api/*` propio ni usan un cliente HTTP interno; los loaders y actions
  de React Router invocan los casos de uso del slice directamente.
- **Prisma confinado:** el acceso a base de datos vive solo en `infrastructure/` y
  en `@coco/db`.
- **Multi-tenant / RLS obligatorio:** toda operación de base de datos se ejecuta
  dentro de `runInTenant(session, work)` o `runInRls(session, work)`, que aplican
  el GUC `app.current_organization_id`. Omitirlo es una fuga de datos entre
  organizaciones.

Referencia completa en `ARCHITECTURE.md`.

## Testing

- **Vitest:** `bun run test`. Specs de casos de uso en `apps/web/tests/contexts/**`
  (puertos stubbeados en memoria) y de componentes en `apps/web/tests/frontend/**`.
- **Cypress:** requiere el stack de desarrollo levantado (`bun run docker:dev`) y
  los usuarios de seed. Specs en `apps/web/cypress/e2e/`.

## Despliegue

Pipeline de CI en `.github/workflows/build.yml` (typecheck, tests, build de imagen
y push a GHCR `ghcr.io/coconsulting2/coco-app`, más `prisma migrate deploy`).
Procedimiento completo, lista de secrets y configuración de almacenamiento en
`DEPLOY.md`.
