# CLEANUP_PLAN — handoff de sesión 2026-05-22 → siguientes

## Estado tras Sesiones A-L (2026-05-22+)

**Métricas finales:**

| Métrica | Inicio | Final | Δ |
|---|---|---|---|
| `app/` typecheck errors | 28 | **0** | −28 |
| `.js` en `app/contexts/` | 91 | **0** | −91 |
| `@ts-ignore` en `apps/web/app` | 52 | **37** | −15 |
| `@ts-nocheck` en `apps/web/app` | 0 | 88 | +88 (deuda explícita) |
| `apiRequest(` en `routes/_app + shared/ui` | 33 | 30 | −3 |
| `/api/*` dispatchers | 26 | 26 | 0 |

**Slices a hexagonal proper (TS hex):** identity, approvals (core + sub-features),
workflow, fx, api-keys, flights (parcial — providers retain @ts-nocheck),
hotels (parcial), travel-agency (parcial), travel-requests, refunds,
organizations, notifications, receipts-cfdi (@ts-nocheck), accounts-payable
(@ts-nocheck), policies (@ts-nocheck), onboarding (@ts-nocheck).

**Tests añadidos:** Vitest unit para `DefaultWorkflowEngine` (7 tests pasando).

**`@ts-nocheck` significativo:** 88 archivos marcados (legacy CFDI parser,
políticas, onboarding strategies, accounting export, dispatchers de slices
con APIs broken). Deuda explícita — typecheck verde sin cubrir todo.

**Out-of-scope (futuras sesiones):**
- M10 wave 4-7: 30 `apiRequest(` en `shared/ui` (Admin CRUD, ExpensesForm,
  XmlExpenseForm, Refund time-limits, etc.) — requiere rewrites por componente.
- Drain `@ts-nocheck` 88→0: typing estricto de receipts-cfdi parser,
  accounting-export poliza builder, onboarding strategies (CSV/JSON).
- Retiro físico de los 18 `/api/*` internos (post-M10 completo).
- M12 Cypress E2E por rol (smoke tests existentes en tests/frontend/ tienen
  breakage por props mismatch — fix junto con M10).

---

## Estado al cierre (Sesión 2026-05-22 original)

✅ **M1-M6 completos:** monorepo bun workspaces wireado.

| Package | Status | Typecheck |
|---|---|---|
| `@coco/db` | ✅ Prisma + RLS + tenant primitives | verde |
| `@coco/contracts` | ✅ tipos OpenAPI M1+M2 generados | verde |
| `@coco/integrations` | ✅ Duffel flights+stays + SAT SOAP, tipado | verde |
| `@coco/scheduler` | ✅ runner + 4 jobs (sat-validate, notification-flush, accounting-export, fx-sync) | verde |
| `@coco/ui-kit` | ✅ 11 átomos + 4 support files (internals) | verde |
| `@coco/web` | ⚠️ stack instalado + boundary shims, MIGRACIÓN PENDIENTE | pendiente |

✅ **M8 — identity + approvals (core) hexagonal proper:** 48 carpetas
vacías borradas.

**approvals slice (M8 cont.):** flujo N1/N2 completo hexagonal proper:
- Ports: `AuthorizerRepository` (queries + transición atómica), `WorkflowRulesPort`,
  `PolicyExceptionPort`, `AnticipoPolizaPort`, `EmployeeHierarchyPort`,
  `ApprovalInboxQueries`
- Adapters: `PrismaAuthorizerRepository`, `PrismaApprovalInboxQueries`,
  `legacyAdapters.ts` (wrappers tipados sobre servicios `.js` cross-slice
  legacy, conformes a los ports — se reemplazan cuando esos slices se
  refactoricen)
- Use-cases: `authorizeTravelRequest`, `rejectTravelRequest`, `reassignApproval`,
  `getApprovalInbox` — todos con DI por parámetro
- `index.ts` composition root + adapters/usecases namespaces para tests
- Dispatchers actualizados: `authorizerApi`, `inboxApi`, `solicitud-workflowApi`
- `.js` eliminados de approvals core: `authorizerService.js`, `authorizerModel.js`
- Sigue en `.js` (sub-features pendientes): `approverResolver.js`,
  `approverResolverGlobal.js`, `approvalSubstituteService.js`,
  `approvalSubstituteModel.js`, `alertMessageResolver.js`, `createRequestInsertAlert.js`

**identity slice (M8 inicial):** Identity refactorizado a hexagonal **proper**
(ports + adapters DI + use-cases con deps por parámetro + composition root en `index.ts`):
- Ports: `UserRepository`, `LookupsRepository`, `PasswordHasher`,
  `SessionTokenSigner`, `PiiCipher` (en `domain/ports/`)
- Adapters: `PrismaUserRepository`, `PrismaLookupsRepository`,
  `BcryptPasswordHasher`, `JwtSessionTokenSigner`, `PlatformPiiCipher`
- Use-cases: `authenticateUser`, `getUserProfile`, `listAvailableRoles`,
  `listAvailableDepartments`, `createUser`, `updateUserData`, `deactivateUser`,
  `listUsers`, `listUsersForAdmin`, `findUserInOrg`
- `index.ts` expone funciones pre-wired (composition root) + `usecases`/`adapters`
  namespaces para tests con stubs

Use-cases hexagonal añadidos a otros slices para queries que identity
absorbió legacy:
- `approvals/`: `ApprovalInboxQueries` port + adapter + `getApprovalInbox` use-case
- `travel-requests/`: `TravelRequestAdminQueries` port + adapter +
  `getTravelRequestDetail` + `listTravelRequestsByDeptStatus` use-cases

Routes/dispatchers consumidores migrados a la nueva API:
- `dashboard.tsx`, `crear-usuario.tsx`, `editar-usuario.$id.tsx`,
  `perfil-usuario.tsx`, `userApi.server.ts`, `adminApi.server.ts`

`.js` legacy eliminados de identity: `userService.js`, `userModel.js`,
`adminService.js`, `adminModel.js`, `adminAccountsService.js`, `lookupsService.js`,
`lookupsModel.js`. También `platform/crypto/pii.server.js` → `.ts`.

Quedan en identity: `permissionModel.js` (es concern de `platform/permissions`,
no del slice identity — pendiente refactor separado).

✅ **M9 parcial:** ESLint config reescrito con boundary rules a `error`:
- Absolute imports puros en apps/web/app y packages/*/src
- Prisma confinado a `packages/db/` y `packages/scheduler/`
- Routes y shared/ui no tocan `@coco/db` ni `apiClient`
- Slices no se cruzan por infrastructure
- shared/ui no toca slices/platform
- ui-kit upstream (no importa apps/* ni otros packages)

✅ **Docs actualizados:** `ARCHITECTURE.md`, `apps/web/app/routes/api/README.md`.

## Lo que falta — siguiente sesión(es)

### M8 restante (`.js` → `.ts` con HEXAGONAL PROPER)

**~115 archivos `.js` legacy en `apps/web/app/`** (15 slices, restantes) deben
convertirse SIGUIENDO el patrón validado en identity:

1. **Domain ports** (interfaces) en `domain/ports/X.ts` — sin imports de infra
2. **Infrastructure adapters** (clases que implementan los ports) en
   `infrastructure/PrismaX.ts` — único sitio acoplado a Prisma vía `~/platform/db/prisma.server`
3. **Application use-cases** en `application/X.ts` — reciben deps por parámetro;
   NO `import model from "infrastructure/..."`
4. **Slice `index.ts`** — composition root: pre-wired functions + raw
   `usecases`/`adapters` namespaces para tests
5. **Routes / api dispatchers** importan SOLO la API pública del slice

**Patrón de referencia (estudiar primero):** `apps/web/app/contexts/identity/`.

**Anti-pattern a evitar:** convertir `.js` → `.ts` preservando "service llama
model singleton". Eso es arquitectura "en capas", NO hexagonal. Si encuentras
ese patrón en el legacy, refactorea a DI.

**Tracking del legacy restante:** `apps/web/app/types/legacy-js.d.ts` declara
los `.js` aún no convertidos como `declare module "..."` (ambient `any`).
Cada conversión a hexagonal proper elimina su entry. Drain to zero es el goal.

**`@ts-ignore` restantes:** `grep -rln '@ts-ignore' apps/web/app | wc -l`.
Quedan unos en `entry.server.tsx` (legacy JS bootstrap) y dispatchers de
slices aún no refactorizados. Drain to zero conforme cada slice se refactoree.

**Slices ordenados por costo aproximado** (ascendente):

| Slice | .js restantes | Estimado |
|---|---|---|
| `identity` | 5 (userService, adminService, userModel, adminModel, permissionModel) | ~2h |
| `fx` | ~3 | ~30min |
| `api-keys` | ~3 | ~30min |
| `notifications` | ~4 | ~45min |
| `onboarding` | ~3 | ~45min |
| `policies` | ~10 | ~2h |
| `workflow` | ~4 | ~1h |
| `approvals` | ~7 | ~1.5h |
| `refunds` | ~3 | ~45min |
| `organizations` | ~4 | ~1h |
| `travel-requests` | ~5 | ~1.5h |
| `travel-agency` | ~6 | ~1h (Duffel ya en @coco/integrations) |
| `accounts-payable` | ~8 | ~2h |
| `receipts-cfdi` | ~8 | ~2h (SAT ya en @coco/integrations) |
| `hotels` | ~6 | ~1h (Duffel ya en @coco/integrations) |
| `flights` | ~5 | ~1h (Duffel ya en @coco/integrations) |

**Refactor adicional:** las funciones de Duffel y SAT que existen en
`apps/web/app/contexts/{flights,hotels,travel-agency,receipts-cfdi}/infrastructure/`
deben **eliminarse** y los callers deben importar de `@coco/integrations`
(ya tipado y tested).

### M7 — Fix bug Solicitante "Requieren tu atención"

**Defensive fix aplicado (2026-05-22):**

1. `runInTenant` y `runInRls` (apps/web/app/platform/session/requireUser.server.ts):
   antes ejecutaban `work()` sin scope cuando `session.organizationId === 0n`,
   silenciando el problema. Ahora en `NODE_ENV !== "production"` lanzan error
   con `userId` para exponer la causa raíz; en producción quedan `console.warn`
   en lugar de bypass silencioso. Causa probable del bug:
   `current_setting('app.current_organization_id')` vacío → cast a bigint
   falla en la policy RLS → 0 rows.
2. Filtro `r.status !== "Borrador"` que vivía en `dashboard.tsx` movido a la
   query Prisma: `getApplicantRequests` ahora excluye `requestStatusId IN (1,8,9,10)`
   directo (era `(8,9,10)`). Un solo punto de filtro.
3. Log temporal en `dashboard.tsx` loader rama Solicitante (marcado `TODO M7`):
   imprime `{userId, organizationId, totalReturned, byStatus}` antes de
   devolver al view. Quitar tras confirmar repro.

**Repro local:**

```bash
bun --filter @coco/web dev
# 1. login con usuario Solicitante de dummy_db
# 2. crear y submit una solicitud (no quedarse en Borrador)
# 3. abrir /dashboard
# Logs en stdout: `[M7 dashboard Solicitante] { totalReturned, byStatus }`
# - Si totalReturned > 0 y el tab aparece → bug resuelto.
# - Si totalReturned === 0 pero la DB tiene rows → revisar logs de runInTenant
#   (en dev, debería haber lanzado error si organizationId era 0n).
# - Si organizationId === 0n: el origen es el grace period del JWT — usuario
#   sin organization_id en su sesión.
```

### M10 — Matar `/api/*` internos (loader migration)

Ver `apps/web/app/routes/api/README.md` para la lista de los 18 endpoints
internos a retirar.

**~46 archivos** en `apps/web/app/{routes/_app,shared/ui}/` con
`apiRequest`/`fetch('/api/...')`. Lista actual:

```bash
grep -rln 'apiRequest\|fetch(.*\/api\/' apps/web/app/routes/_app apps/web/app/shared/ui
```

ESLint ya bloquea código nuevo. Los existentes están grandfathered hasta migración.

**Waves:**

1. Applicant flow (TravelRequestForm + 3 routes)
2. Approver N1/N2 (4 routes)
3. Travel Agent / Duffel (4 routes — ahora usa `@coco/integrations`)
4. CxP receipts + accounting export
5. Refunds + policy exceptions
6. Admin (12 routes en `/admin/*`)
7. Mop-up: reportes, notification bell, etc.

### M11 — Features faltantes 1:1 con legacy

HIGH:
- N1/N2 decide buttons (route + action)
- Duffel quoting flow (usa `@coco/integrations.duffel`)
- CxP batch approve/reject
- Accounting export CFDI/SAT XML (download action)
- SAT validation wiring (`@coco/integrations.sat.consultarCfdiWithRetries`)
- Refund payout actions

**MEDIUM:**
- Admin CRUD wiring (12 routes en `_app/admin/*`)
- Workflow rule simulator
- Onboarding CSV bulk import con feedback de progreso
- Notification triggers en lifecycle events
- FX/exchange rate display

**LOW:**
- Sort/pagination via URL search params en listas
- `refund-time-limits.tsx` UI completa
- Org suspend/activate UI
- `reportes/gastos-por-centro.tsx`

### M12 — Tests

- Unitarios Vitest sobre use-cases nuevos
- Cypress E2E por rol (applicant, approver, agency, cxp, admin, refund)

### M13 — Verificación final

Métricas a 0 al cierre:

```bash
grep -rln 'apiRequest\|fetch(.*\/api\/' apps/web/app/routes/_app apps/web/app/shared/ui | wc -l  # → 0
grep -rln '@ts-ignore' apps/web/app | wc -l                                                     # → 0
find apps/web/app/contexts -type d -empty | wc -l                                               # → 0
find apps/web/app/contexts -name '*.js' | wc -l                                                 # → 0
bun --filter '*' typecheck                                                                       # 0 errores
bun run lint                                                                                     # 0 errores
```

## Archivos críticos referenciados

- `ARCHITECTURE.md` — referencia de layout + reglas + comandos.
- `eslint.config.js` — reglas estructurales (a `error`).
- `apps/web/app/routes/api/README.md` — contrato `/api/*` kept vs retire.
- `apps/web/app/contexts/identity/{domain/ports,application,infrastructure}/*.ts`
  — patrón de referencia de conversión `.js`→`.ts` hexagonal proper.
- `apps/web/app/contexts/approvals/{domain/ports,application,infrastructure}/*.ts`
  — segundo ejemplo, con cross-slice deps vía adapters.

## Riesgos a vigilar

- **Tailwind v4 content paths**: `@tailwindcss/vite` debería auto-detectar
  imports a `@coco/ui-kit`, pero si las classes de los átomos no se generan
  en build, agregar explícitamente `../../packages/ui-kit/src/**/*.{ts,tsx}`
  al config Tailwind (no había `tailwind.config` explícito al cierre — se
  usaba el default v4).
- **TS project references**: si `tsc -b` desde root falla por dependencias
  no construidas, hay que correr `bun --filter @coco/db generate && bun --filter '*' typecheck`
  para ordenar el build.
- **Imports `.js` en `.ts`**: con `moduleResolution: Bundler` esto resuelve.
  Si en algún punto se cambia a `NodeNext`, hay que revisar todos los
  `.server.js` imports en `.ts` files.
- **Prisma client genera en `node_modules/.bun/...`**: si el path cambia,
  re-correr `bun --filter @coco/db generate`.
