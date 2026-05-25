# coco-app

Fusión de `TC3005B.501-Backend` (Express + Prisma + Postgres + MongoDB GridFS + S3) y `TC3005B.501-Frontend` (Astro + React + Tailwind v4) en un único proyecto **React Router v7 framework mode** con **arquitectura hexagonal** y **vertical slicing por bounded context**.

## Estado de la migración

Migración por fases — **cerrada al 2026-05-25**. Ver `CLEANUP_PLAN.md` y
`ARCHITECTURE.md` para el detalle.

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Bootstrap: estructura, configs, copia verbatim de prisma/openapi/certs/cypress/types/utils/components, platform layer (RLS, JWT, sesión, CSRF, permisos) | ✅ |
| 1 | Slice identity: `/login`, `/dashboard`, `/perfil-usuario`, crear/editar usuario | ✅ |
| 2 | Slices read-only: fx, flights, hotels, notifications, policies, refunds, organizations, api-keys | ✅ |
| 3 | Núcleo: travel-requests + approvals + workflow (crear/editar/cancelar solicitud, autorizaciones, comentarios) | ✅ |
| 4 | Receipts/CFDI + travel-agency + accounts-payable (upload GridFS, SAT SOAP, Duffel, exportación contable) | ✅ |
| 5 | Admin slices: policies, refunds, onboarding, workflow-rules, organizations write | ✅ |
| 6 | Hardening: slices 100% hexagonal en TS, `@ts-nocheck`/`@ts-ignore` a 0 fuera de tests, imports alias legacy migrados a `~/shared/...` | ✅ |

Todos los slices `app/contexts/**` son 100% hexagonal en TypeScript (0 `.js`).
Los únicos `.js` restantes son platform boundaries en `app/platform/**`
(declarados tipados en `app/types/legacy-js.d.ts`). Routes y `shared/ui` no
hacen `apiRequest`/`fetch('/api/...')` salvo un residual conocido
(`ExpensesDashboard.tsx`).

## Arquitectura

```
coco-app/
├── prisma/                      # schema, migrations, seeds (copiados verbatim del legacy)
├── certs/                       # HTTPS self-signed + Wise mTLS
├── openapi/                     # 38 YAML preservados como contrato
├── public/                      # logos, fonts, sw.js
├── cypress/                     # 15 specs E2E (baseUrl: localhost:5173)
└── app/
    ├── root.tsx                 # HTML shell + ErrorBoundary
    ├── entry.server.tsx         # bootstrap: connectMongo, connectPostgres, scheduler
    ├── entry.client.tsx
    ├── routes.ts                # config-based routing
    ├── platform/                # ÚNICO pedazo horizontal
    │   ├── db/                  # Prisma client + RLS + tenant-extension + tenant-context
    │   ├── session/             # JWT, cookies, requireUser, runInTenant
    │   ├── permissions/         # RBAC granular cached
    │   ├── csrf/                # double-submit cookie
    │   ├── crypto/              # AES-256-CBC PII decrypt
    │   ├── mongo/, s3/, mail/, push/, scheduler/, http/, validation/, api-key/, logger/
    ├── shared/                  # kernel léxico
    │   ├── ui/                  # 107 componentes React copiados verbatim
    │   ├── layouts/             # MainLayout, Sidebar, PageHeader (reescritos como React)
    │   ├── types/, utils/, config/, styles/, data/, stores/, assets/
    ├── contexts/                # 16 slices verticales
    │   ├── identity/
    │   │   ├── domain/          # entities + ports + value-objects
    │   │   ├── application/     # userService, adminService (use-cases)
    │   │   ├── infrastructure/  # userModel, adminModel, permissionModel (Prisma repos)
    │   │   └── interface/       # api/userApi.server.ts dispatcher
    │   ├── travel-requests/, approvals/, travel-agency/, receipts-cfdi/,
    │   │   accounts-payable/, policies/, refunds/, notifications/,
    │   │   fx/, flights/, hotels/, organizations/, api-keys/, workflow/, onboarding/
    └── routes/
        ├── _public/             # /, /login, /404
        ├── _app/                # rutas autenticadas (auth gating en _layout)
        └── api/                 # resource routes solo cuando hay razón externa
```

## Filosofía DI > HTTP doble-hop

Los `loaders` y `actions` de cada ruta llaman a los use-cases del slice **directamente** vía imports (DI). NO se hace `fetch` interno a `/api/*`. Esto elimina:
- Serialización JSON innecesaria.
- Doble validación.
- Roundtrip HTTP cuando origen y destino están en el mismo proceso.

Los endpoints `/api/*` se conservan SOLO cuando hay razón externa:
- `/api/user/{login,logout,csrf-token}` — la LoginForm legacy los consume.
- `/api/external/*` — integraciones de terceros con API key.
- `/api/files/*` — uploads multipart.
- `/api/comprobantes/*` — CFDI documentado en OpenAPI.

## RLS multi-tenant — obligatorio

Toda función que toque DB se envuelve en `runInTenant(session, work)` o `runInRls(session, work)`. Ver `CONTRIBUTING.md`.

## Comandos

```bash
bun install                  # install deps
bun run dev                  # vite dev server HTTPS :5173 (front + back juntos)
bun run build                # build de producción
bun run start                # serve build

bun run typecheck            # tsc --noEmit
bun run lint                 # ESLint (incluye reglas estructurales anti-fuga)
bun run lint:fix             # auto-fix

bun run test                 # vitest unit
bun run test:e2e             # cypress headless
bun run test:e2e:open        # cypress interactivo

bun run dummy_db             # reset Prisma DB + seed con datos dummy
bun run empty_db             # reset Prisma DB + seed mínimo
bun run migrate              # prisma migrate dev
bun run generate             # prisma generate
bun run studio               # prisma studio
bun run seed                 # seed-orgs.js
```

## Setup

1. `bun install`
2. Copia `.env.example` → `.env` y completa secrets (DATABASE_URL, JWT_SECRET, SESSION_SECRET, AES_SECRET_KEY, MONGO_URI, AWS_*, VAPID_*, etc.). Mínimo para dev:
   - `DATABASE_URL` → Postgres local (puerto 5434 si usas el docker compose del legacy).
   - `MONGO_URI` → MongoDB local.
   - `JWT_SECRET` → cualquier secret.
   - `AES_SECRET_KEY` → 32 chars hex.
3. `bunx prisma generate`
4. `bun run dummy_db` (carga seed con datos dummy).
5. `bun run dev` → abre https://localhost:5173/login (accept cert).
6. Login con credenciales del seed (ej. `andres.gomez` / `andres123`).

## Tests E2E (Cypress)

Las 15 specs del frontend legacy se preservaron en `cypress/e2e/`. Asegúrate de que `cypress.config.ts` apunte a `baseUrl: https://localhost:5173`.

```bash
bun run test:e2e:open
```

## Migration log

Mira `git log` por commits con prefijo `feat/full/migration-*`.
