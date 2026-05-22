# Arquitectura — coco-app (monorepo bun workspaces)

## Layout

```
coco-app/                              ← bun workspace root
├── package.json                       (workspaces: ["apps/*", "packages/*"])
├── tsconfig.base.json                 (compilerOptions compartidos)
├── tsconfig.json                      (project references)
├── eslint.config.js                   (boundary rules globales)
├── apps/
│   └── web/                           @coco/web — RR7 framework-mode SSR
│       ├── app/
│       │   ├── platform/              (csrf, http, logger, mail, mongo, permissions, push, s3, session, validation, db (shim))
│       │   ├── contexts/<slice>/      (16 bounded contexts hexagonales)
│       │   │   ├── domain/            (entidades + ports puros)
│       │   │   ├── application/       (use-cases)
│       │   │   ├── infrastructure/    (Prisma queries — ÚNICO sitio acoplado a @coco/db)
│       │   │   └── interface/         (api dispatcher + views/loaders/actions)
│       │   ├── shared/                (ui domain-aware, hooks, utils, types, layouts)
│       │   └── routes/                (RR7 file routes)
│       ├── openapi/                   (Swagger YAMLs — fuente de @coco/contracts)
│       ├── cypress/                   (E2E)
│       └── tests/                     (Vitest server-side)
└── packages/
    ├── db/                            @coco/db
    │   ├── prisma/                    (schema.prisma + migrations + seeds)
    │   └── src/
    │       ├── client.ts              (prismaBase + prisma con tenant)
    │       ├── tenant.ts              (AsyncLocalStorage + withTenantContext)
    │       ├── tenant-extension.ts    (Prisma extension scoping orgId)
    │       ├── rls.ts                 (applyRlsSetting, withRls)
    │       └── index.ts               (public API)
    ├── contracts/                     @coco/contracts
    │   ├── scripts/generate.ts        (openapi-typescript)
    │   └── src/{m1,m2,index}.ts       (tipos generados — AUTO-GENERATED)
    ├── integrations/                  @coco/integrations
    │   └── src/
    │       ├── duffel/{client,flights,stays,index}.ts   (Duffel SDK)
    │       └── sat/{consulta,index}.ts                  (SOAP CFDI validation)
    ├── scheduler/                     @coco/scheduler — worker process
    │   └── src/
    │       ├── runner.ts              (entry-point bun-executable)
    │       ├── logger.ts              (pino)
    │       ├── types.ts               (CronJob, JobContext, JobResult)
    │       └── jobs/                  (sat-validate-batch, notification-flush, accounting-export-batch, exchange-rate-sync)
    └── ui-kit/                        @coco/ui-kit — átomos puros (sin dominio)
        └── src/
            ├── {Button,Modal,Alert,Badge,InputField,Select,TextArea,Toast,ProgressBar,MaterialIcon,ModalWrapper}.tsx
            └── internal/{button,input,modal,progressBar}.ts
```

## Reglas estructurales (enforced por ESLint)

1. **Imports absolutos puros.** En `apps/web/app/**` y `packages/*/src/**` está
   prohibido cualquier `./X` o `../X`. Usar:
   - `~/...` para apps/web/app
   - `#/...` para internals de un package (vía `package.json#imports`)
   - `@coco/...` para cross-package
   - paquetes npm directos

2. **Prisma confinado.** Solo `packages/db/**` y `packages/scheduler/**`
   importan `@prisma/client`. El resto consume `@coco/db`.

3. **Routes nunca tocan infrastructure ni `@coco/db` directo.** Solo
   `~/contexts/<slice>` (API pública) o `~/contexts/<slice>/application/*`.

4. **`@coco/db` no se importa desde `apps/web/app/routes/**` ni desde
   `apps/web/app/shared/ui/**`.** Esos consumen use-cases del slice.

5. **Slices no se cruzan por infrastructure.** `~/contexts/A/infrastructure/...`
   desde `~/contexts/B/...` es **error**. Cross-slice solo por API pública.

6. **shared/ui no depende de slices/platform.** UI domain-aware recibe data
   por props. Átomos puros viven en `@coco/ui-kit`.

7. **Páginas internas no consumen `/api/*` propias.** En
   `apps/web/app/routes/_app/**` y `apps/web/app/shared/ui/**` está prohibido
   importar `apiClient` y hacer `fetch('/api/...')`. Toda data interna pasa
   por loader/action de RR7.

8. **`@coco/ui-kit` upstream.** No puede importar de apps/* ni de otros
   packages (excepto React + Tailwind).

## Multi-tenant / RLS

Toda función que toque DB DEBE estar dentro de `runInTenant(session, work)` o
`runInRls(session, work)` (apps/web/app/platform/session/requireUser.server.ts,
que compone primitivas de `@coco/db`). Saltarte uno = data leak entre
organizaciones.

- `runInTenant`: SET de sesión (no transaccional). Más rápido. Usar para
  reads tolerantes a pool reuse.
- `runInRls`: SET LOCAL en transacción dedicada. Aislamiento estricto. Usar
  para mutaciones críticas y operaciones cross-org de super-admin Ditta.

Las primitivas `withTenantContext` (AsyncLocalStorage) y `applyRlsSetting`/
`withRls` (GUC Postgres) viven en `@coco/db` y son las únicas piezas de
verdad. `runInTenant` en apps/web compone sesión web + esas primitivas.

## Where does X go?

| X | Donde vive |
|---|---|
| Schema Prisma / migraciones / seeds | `packages/db/prisma/` |
| Cliente Prisma + RLS + tenant context | `packages/db/src/` |
| Tipos generados desde OpenAPI Swagger | `packages/contracts/src/` |
| Wrapper Duffel / SOAP SAT / cualquier 3rd-party | `packages/integrations/src/<provider>/` |
| Cron job / background worker | `packages/scheduler/src/jobs/` (si solo depende de @coco/db + @coco/integrations) |
| Cron que llama lógica de slice | `apps/web/app/platform/scheduler/` (legacy: escalation, refund-deadline, approval-substitute) |
| Componente UI sin dependencia de dominio (Button, Modal, etc.) | `packages/ui-kit/src/` |
| Componente UI con dependencia de dominio (TravelRequestForm, etc.) | `apps/web/app/shared/ui/` |
| Page/route RR7 | `apps/web/app/routes/` |
| Use-case de un slice | `apps/web/app/contexts/<slice>/application/` |
| Query Prisma de un slice | `apps/web/app/contexts/<slice>/infrastructure/` |
| Tipo de dominio (entidad/port) | `apps/web/app/contexts/<slice>/domain/` |
| API pública del slice (lo que otros importan) | `apps/web/app/contexts/<slice>/index.ts` |

## Comandos

```bash
# Desarrollo
bun install                          # instala todo el workspace
bun --filter @coco/web dev           # arranca web app (RR7 + Vite, HTTPS:5173)
bun --filter @coco/scheduler dev     # arranca worker process (cron jobs)

# Build / verificación
bun --filter @coco/web build
bun --filter @coco/web typecheck
bun --filter '*' typecheck           # typecheck todos los packages
bun run lint                         # ESLint del workspace
bun --filter @coco/web test:e2e      # Cypress headless

# DB (todo desde packages/db)
bun --filter @coco/db generate       # prisma generate
bun --filter @coco/db migrate        # prisma migrate dev
bun --filter @coco/db studio
bun --filter @coco/db seed
bun --filter @coco/db seed:dummy

# Contratos OpenAPI → TS types
bun --filter @coco/contracts generate
```

## Patrón: cómo invocar un slice desde una route

```ts
// apps/web/app/routes/_app/historial.tsx
import { requireAnyPermission, runInTenant } from "~/platform/session/requireUser.server.js";
import { listCompletedRequests } from "~/contexts/travel-requests/application/applicantQueryService.js";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireAnyPermission(request, "travel_request:view_any");
  const requests = await runInTenant(session, async () =>
    listCompletedRequests(session.user.user_id),
  );
  return { requests };
}
```

**Patrón siempre:**

1. `requireSession` / `requirePermissions` / `requireAnyPermission` al inicio
   — valida JWT, IP, organization_id, permisos.
2. `runInTenant(session, work)` envuelve queries — aplica RLS GUC
   `app.current_organization_id` y entra al AsyncLocalStorage del tenant.
3. El callback llama use-cases del slice (NUNCA Prisma directo).
4. Mutaciones añaden `await assertCsrf(request)` antes del body.

## Slice de referencia: `identity/`

Es el más completo arquitectónicamente. Estudiar primero:

```
contexts/identity/
├── index.ts                          # API pública del slice
├── domain/
│   ├── entities/User.ts              # UserIdentity, UserProfile, CreateUserInput
│   ├── ports/UserRepository.ts       # interface — el "contrato"
│   ├── ports/PasswordHasher.ts
│   ├── ports/PiiCipher.ts
│   ├── ports/SessionTokenSigner.ts
│   └── errors.ts                     # InvalidCredentialsError, etc.
├── application/
│   ├── adminAccountsService.ts       # ← convertido a .ts (referencia)
│   ├── lookupsService.ts             # ← convertido a .ts (referencia)
│   ├── userService.js                # legacy — pendiente .js → .ts
│   └── adminService.js               # legacy — pendiente .js → .ts
├── infrastructure/
│   ├── lookupsModel.ts               # ← convertido a .ts (referencia)
│   ├── userModel.js                  # legacy — pendiente
│   ├── adminModel.js                 # legacy — pendiente
│   └── permissionModel.js            # legacy — pendiente
└── interface/
    └── api/{userApi,adminApi,permissionApi}.server.ts
```
