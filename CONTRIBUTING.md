# Contribuyendo a coco-app

`coco-app/` es la fusión de los dos repos `TC3005B.501-Backend` (Express + Prisma) y `TC3005B.501-Frontend` (Astro + React) en un único proyecto **React Router v7 framework mode** con **arquitectura hexagonal** y **vertical slicing por bounded context**.

Este documento describe las convenciones obligatorias. Reglas estructurales (no-fuga de Prisma, no-import cross-slice por infrastructure, etc.) están enforzadas por ESLint — ver `eslint.config.js`.

## Naming (idéntico a cocowiki / estiloCodigo)

| Contexto | Estilo | Ejemplo |
|---|---|---|
| Componentes React | PascalCase | `LoginForm.tsx` |
| Funciones JS/TS | camelCase | `getUserData()` |
| Variables | camelCase | `formData` |
| Constantes globales | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Campos de BD | snake_case | `user_id`, `beginning_date` |
| Rutas API | kebab-case | `/api/travel-agent` |

## Lenguajes por carpeta

- **Platform & contexts (server)**: `.js` o `.ts` — el código copiado del backend legacy permanece `.js` por compatibilidad (no rompemos imports masivamente). Código nuevo: `.ts`.
- **Frontend (routes, UI)**: `.tsx` para componentes con JSX, `.ts` para utilidades.

## Arquitectura — vertical slicing + hexagonal interno

```
app/
├── platform/           # único pedazo horizontal: prisma client, sesión, RLS, CSRF, S3, GridFS, mail, push, scheduler
├── shared/             # kernel léxico cross-slice: tipos, UI atoms, utilidades sin dominio
├── contexts/<slice>/
│   ├── domain/         # ports + entities + value-objects (SIN imports de infraestructura)
│   ├── application/    # use-cases — orquesta ports, sin tocar Prisma directo
│   ├── infrastructure/ # adapters: PrismaRepository, GridFS, Duffel, SAT SOAP. ÚNICO lugar que toca Prisma.
│   └── interface/      # actions/loaders/views/api dispatchers — la "puerta de entrada"
└── routes/             # thin RR v7 routing — loaders/actions llaman use-cases por DI
```

## Reglas estructurales (enforced por ESLint)

1. **Absolute path imports only.** Cross-folder usa el alias `~/*`. Prohibido `../../` o más profundo. Ejemplo:
   ```ts
   // ✅ correcto
   import { runInTenant } from "~/platform/session/requireUser.server";
   import * as userService from "~/contexts/identity/application/userService";

   // ❌ ESLint error
   import { runInTenant } from "../../../platform/session/requireUser.server";
   ```
   Permitido: `./X` (intra-folder) y `../X` (un solo nivel, intra-package). Bloqueado: `../../X` y deeper.

2. **Solo `infrastructure/` y `platform/db/` pueden importar `@prisma/client`.** Si necesitas datos en un use-case, define un port en `domain/ports/` y un adapter en `infrastructure/`.

3. **No cross-slice por `infrastructure/`.** Si necesitas datos de otro slice, importa su use-case desde `~/contexts/<other>/application/` o desde el `index.ts` público.

4. **Routes no importan `infrastructure/`.** Llaman use-cases del slice.

5. **`shared/ui/` no depende de slices ni platform.** Componentes UI reciben datos por props.

## RLS / multi-tenant — OBLIGATORIO

Toda función que toque DB DEBE ejecutarse dentro de `runInTenant(session, work)` o `runInRls(session, work)`:

```ts
import { requireSession, runInTenant } from "~/platform/session/requireUser.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);
  return runInTenant(session, async () => {
    return await applicantService.listRequests(session.user.user_id);
  });
}
```

- `runInTenant` aplica el GUC Postgres `app.current_organization_id` a la sesión y entra al `AsyncLocalStorage` del tenant-extension de Prisma (que inyecta `where.organizationId` automático).
- `runInRls` usa `SET LOCAL` en una transacción dedicada (aislamiento estricto). Úsalo para mutaciones críticas y operaciones cross-org de super-admin Ditta.
- Saltarte cualquiera de los dos = data leak entre organizaciones.

## Permisos

Use `requirePermissions(request, "code:atomic", ...)` al inicio de actions/loaders que requieran un permiso específico. La lista de permisos atómicos está en `app/platform/permissions/catalog.ts` y en el seed de Prisma.

## CSRF

Acciones mutantes (POST/PUT/PATCH/DELETE) DEBEN invocar `await assertCsrf(request)` al inicio. Excepciones: `POST /api/user/login`, `GET /api/user/csrf-token`.

## Resource routes `/api/*` — cuándo crearlos

**No crees endpoints `/api/*` por costumbre.** El flujo principal es: `<Form method="post">` → action de la ruta → use-case por DI → return loader data.

Crea `/api/*` SOLO si:
- Lo consume `LoginForm.tsx` u otro componente legacy via `apiClient`.
- Lo consume un tercero (API key external).
- Está documentado en OpenAPI como contrato público.
- Es upload multipart (mejor con endpoint estable).

## Branches y commits

Idéntico a cocowiki: `tipo/area/descripcion-corta` para branches; `tipo: msg en inglés` (imperativo) para commits.

```
feat/full/identity-slice-migration
fix/back/rls-leak-pool-reuse
docs/front/contributing
```

## Tests

- **Unit**: vitest. Coloca specs como `*.test.ts` junto al archivo bajo prueba.
- **Integration**: vitest + supertest contra resource routes.
- **E2E**: cypress con `baseUrl: https://localhost:5173`.

## ESLint

```bash
bun run lint        # report
bun run lint:fix    # auto-fix
```

Antes de cada commit, corre `bun run lint`. Errores bloquean; warnings se pueden dejar pendientes.
