# Arquitectura — coco-app

## Vertical slicing + hexagonal interno

```
app/
├── platform/          # ← horizontal: infra compartida (Prisma, sesión, RLS, CSRF, S3, mail)
├── shared/            # ← horizontal: tipos, UI atoms, utilidades sin dominio
├── contexts/<slice>/  # ← vertical: un bounded context por carpeta
│   ├── domain/        # entidades + ports + errores (PURO — sin imports de infra)
│   ├── application/   # use-cases — orquesta ports
│   ├── infrastructure/# adapters concretos — ÚNICO lugar que toca Prisma
│   └── interface/     # entrada HTTP (loaders/actions/api dispatcher)
└── routes/            # thin RR v7 routing — invoca use-cases por DI
```

## Reglas (enforced por ESLint, ver `eslint.config.js`)

1. **Routes nunca importan infrastructure ni Prisma directo.** Solo
   `~/contexts/<slice>` (API pública) o `~/contexts/<slice>/application/*` (use-cases).

2. **Application no importa Prisma ni infrastructure de otros slices.**
   Excepción: legacy services grandfathered en `eslint.config.js` ignores
   (lista en `CLEANUP_PLAN.md`).

3. **Domain es puro.** Cero imports de Prisma, fetch, fs, etc. Solo otros
   archivos de su mismo `domain/`.

4. **Imports cross-folder siempre absolutos (`~/*`).** `../X` solo para
   intra-folder. `../../X` o más profundo → ESLint **error**.

5. **shared/ui no depende de slices ni platform.** Componentes UI reciben
   datos por props.

## Slice de referencia: `identity/`

Es el slice más completo arquitectónicamente. Estudiar primero:

```
contexts/identity/
├── index.ts                          # ← API pública del slice
├── domain/
│   ├── entities/User.ts              # UserIdentity, UserProfile, CreateUserInput
│   ├── ports/UserRepository.ts       # interface — el "contrato"
│   ├── ports/PasswordHasher.ts
│   ├── ports/PiiCipher.ts
│   ├── ports/SessionTokenSigner.ts
│   └── errors.ts                     # InvalidCredentialsError, etc.
├── application/
│   ├── userService.js                # use-cases (JS — copiado del legacy)
│   ├── adminService.js
│   ├── adminAccountsService.js       # wrapper thin para deactivate
│   ├── lookupsService.js             # roles + departments para forms
│   └── (futuro: refactor a TS con DI explícita de ports)
├── infrastructure/
│   ├── userModel.js                  # repo Prisma — ÚNICO que toca @prisma/client
│   ├── adminModel.js
│   ├── permissionModel.js
│   └── lookupsModel.js
└── interface/
    └── api/userApi.server.ts         # dispatcher /api/user/* (resource route)
```

## Cómo invocar un slice desde una route

```ts
// app/routes/_app/historial.tsx
import { requireAnyPermission, runInTenant } from "~/platform/session/requireUser.server";
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
3. El callback llama use-cases del slice (NUNCA `prisma.X` directo).
4. Mutaciones añaden `await assertCsrf(request)` antes del body.

## Cómo crear un slice nuevo

```bash
SLICE_NAME="mi-slice"
cp -R templates/slice-template app/contexts/$SLICE_NAME
find app/contexts/$SLICE_NAME -type f -exec sed -i '' "s/__slice__/$SLICE_NAME/g" {} \;
find app/contexts/$SLICE_NAME -type f -exec sed -i '' "s/__Slice__/$(echo $SLICE_NAME | awk -F- '{for(i=1;i<=NF;i++)printf("%s%s",toupper(substr($i,1,1)),substr($i,2))}')/g" {} \;
```

Luego:

1. Adapta `domain/entities/MyEntity.ts` al dominio real.
2. Implementa el adapter Prisma en `infrastructure/PrismaMyRepository.server.ts`.
3. Escribe use-cases en `application/` recibiendo ports por DI.
4. Si se necesita endpoint externo, dispatcher en `interface/api/`.
5. `index.ts` re-exporta solo lo público.

## Cómo escribir un use-case con DI (idiomático)

```ts
// app/contexts/__slice__/application/createMyEntity.ts
import type { MyRepository } from "~/contexts/__slice__/domain/ports/MyRepository";
import type { CreateMyEntityInput, MyEntity } from "~/contexts/__slice__/domain/entities/MyEntity";

export async function createMyEntity(
  input: CreateMyEntityInput,
  deps: { repo: MyRepository },
): Promise<MyEntity> {
  // 1. Validación de dominio (puede usar zod schemas en application/dto/)
  // 2. Lógica de negocio
  // 3. Persistencia vía port
  return deps.repo.save(input);
}
```

Acción HTTP que invoca el use-case:

```ts
// app/routes/_app/mi-entidad.tsx
import { PrismaMyRepository } from "~/contexts/__slice__/infrastructure/PrismaMyRepository.server";
import { createMyEntity } from "~/contexts/__slice__/application/createMyEntity";

export async function action({ request }: ActionFunctionArgs) {
  const session = await requirePermissions(request, "__slice__:create");
  await assertCsrf(request);
  const body = await request.json();
  await runInTenant(session, async () =>
    createMyEntity(body, { repo: new PrismaMyRepository() }),
  );
  return redirect("/dashboard");
}
```

La acción **arma** las dependencias (`new PrismaMyRepository()`); el use-case
las **recibe**. En tests, inyectas un repo en memoria.

## Multi-tenant / RLS — recordatorio crítico

Toda función que toque DB DEBE estar dentro de `runInTenant(session, work)` o
`runInRls(session, work)`. Saltarte uno = data leak entre organizaciones.

- `runInTenant`: SET de sesión (no transaccional). Más rápido. Usar para
  reads tolerantes a pool reuse.
- `runInRls`: SET LOCAL en transacción dedicada. Aislamiento estricto. Usar
  para mutaciones críticas y operaciones cross-org de super-admin Ditta.
