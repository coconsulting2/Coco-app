# LANE-ARQUITECTURA — Auditoría transversal (READ-ONLY)

> Generado: 2026-05-25 · Static analysis (greps + lectura). Cita `file:line` por hallazgo.
> Severidad: 🔥 blocking · 🔴 missing · 🟡 incomplete · 🔵 architecture/debt.

## Resumen + veredicto

La arquitectura hexagonal del monorepo está **sólida y en gran medida sana**: los 16 slices
respetan el patrón (use-case → port → adapter Prisma → DI), no hay `PrismaClient` instanciado
fuera de infrastructure/`@coco/db`, RLS (`runInTenant`/`runInRls`) está presente en los paths de
datos muestreados, CSRF está cubierto en las actions mutantes (las 4 sin `assertCsrf` son
exenciones legítimas o cobertura transitiva), y **bun es el único package manager** (cero
pnpm/npm). La Regla 4 (no `/api` desde routes/shared) está limpia en código vivo — el único
`fetch('/api/...')` real vive en un componente huérfano (no montado).

Las debilidades son de **higiene/dead-code, no de corrección de flujos**:
1. **8 archivos `routes/api/*.$.tsx` no registrados en `routes.ts`** → rutas muertas. Una de
   ellas (`accounts-payable`) está **documentada como contrato externo Swagger M1** pero
   devuelve 404 → única regresión con impacto externo real (🔴).
2. **~21 componentes `shared/ui/*.tsx` huérfanos** (cero importadores), de los cuales ~7 son
   shims de re-export hacia `@coco/ui-kit` ya muertos, y ~14 son features/wrappers reales sin
   punto de montaje (incluye `ApprovalsInbox`, `ExchangeRateDisplay`, el cluster de upload).
3. **Imports relativos** residuales en `shared/ui/comments/*`, `shared/layouts/MainLayout.tsx`,
   `shared/types/FormData.ts` y 2 barrels de packages (Regla 1, 🔵).
4. **`as unknown as` profuso** en infrastructure (boundary Prisma, aceptado por convención) +
   2 `eslint-disable no-explicit-any` a nivel de archivo en `applicantModel.ts`/`gastoTramoModel.ts`
   + `as any` en `apiClient.ts`/`cookies.ts` y en los 25 dispatchers `params as any` (Regla 2, 🔵/🟡).

**Veredicto: arquitectura HEALTHY con deuda de limpieza acotada.** Cero violaciones que rompan
flujos internos. El único riesgo funcional es el contrato externo `/api/accounts-payable` caído.

### Conteo de severidad
- 🔥 blocking: **0**
- 🔴 missing: **1** (contrato externo `/api/accounts-payable` no ruteado)
- 🟡 incomplete: **3** (`as any` en apiClient/cookies; eslint-disable de archivo ×2 dispatchers; orphan features reales)
- 🔵 architecture/debt: **~6 clusters** (imports relativos, `as unknown as`, `params as any` ×25, shims muertos, leak de Prisma args en application, api routes internas muertas)

---

## 1. Tabla de violaciones de reglas

| Regla | Archivo:línea | Detalle | Severidad |
|---|---|---|---|
| **1** imports relativos | `shared/ui/comments/CommentMessageGroup.tsx:7` | `import Avatar from './Avatar'` | 🔵 |
| **1** | `shared/ui/comments/CommentsThread.tsx:11-13,16` | `./CommentMessage`, `./CommentMessageGroup`, `./CommentInput`, `./Error.tsx` | 🔵 |
| **1** | `shared/types/FormData.ts:1` | `import type { TravelRoute } from './TravelRoute'` | 🔵 |
| **1** | `shared/layouts/MainLayout.tsx:12-13` | `./Sidebar`, `./PageHeader` | 🔵 |
| **1** | `packages/db/src/index.ts:45,55` | `../prisma/seedHelpers/*` (cruza fuera de `src/`; no usa `#/`) | 🔵 |
| **1** | `packages/shared-config/src/index.ts:6-7` | `./accountingCatalogs.js`, `./tenantApplicantCapability.js` (barrel relativo) | 🔵 |
| **1** (platform `.js`) | `platform/scheduler/index.js:13-14`, `platform/push/webpush.server.js:7`, `platform/permissions/*.server.js`, `platform/csrf/csrf.server.ts:18`, `platform/session/auth-middleware.server.js:13` | `../` y `./` en platform boundaries `.js` | 🔵 (boundary legacy declarado en `types/legacy-js.d.ts`; aceptable pero técnicamente fuera de regla para `.ts` `csrf.server.ts:18`) |
| **2** `as any` | `shared/utils/apiClient.ts:38-39,77` | `(import.meta as any).env` (×4) — evade tipos Vite; debería usar `ImportMetaEnv` | 🟡 |
| **2** `as any` | `shared/data/cookies.ts:46` | `(globalThis as any).Astro` — residuo Astro en app RR7 (probable dead code) | 🟡 |
| **2** `as any` | `routes/api/*.$.tsx:13/17` (25 archivos, ×2 c/u = 50 sitios) | `getSubpath(params as any)` en todos los dispatchers | 🔵 (patrón sistemático; arreglable tipando `params` del splat `*`) |
| **2** `as any` + eslint-disable archivo | `contexts/travel-requests/infrastructure/applicantModel.ts:5` (`/* eslint-disable no-explicit-any */`) + `:516` (`} as any`) | disable a nivel de **archivo** entero + cast crudo | 🟡 |
| **2** eslint-disable archivo | `contexts/travel-requests/infrastructure/gastoTramoModel.ts:5` | `/* eslint-disable no-explicit-any */` a nivel de archivo | 🟡 |
| **2** `as unknown as` (boundary infra) | `contexts/{organizations,identity,api-keys,policies,accounts-payable,flights,hotels,receipts-cfdi,approvals,notifications,workflow}/infrastructure/*.ts` (~40 sitios) | Casts en frontera Prisma↔dominio | 🔵 (convención aceptada y documentada, p.ej. `PrismaNotificationRepository.ts:28-31`) |
| **2** `as unknown as` en application | `policies/application/{policyAlertService.ts:107,policyService.ts:245}`, `accounts-payable/application/anticipoPolizaLifecycleService.ts:44`, `receipts-cfdi/application/registerReceiptCfdi.ts:143` | Cast en capa de aplicación (no infra) — leak menor | 🔵 |
| **3** Prisma fuera de infra | `contexts/accounts-payable/application/expenseReportService.ts:11,190,209` | Importa `Prisma` (namespace de tipos) y usa `prisma.receipt.findMany`/`department.findMany`. **MITIGANTE**: el `prisma` es **parámetro inyectado** (`ExpenseReportPrismaClient` estructural) por `PrismaExpenseReportQueries.ts`; no instancia cliente. Leak: la capa app conoce `Prisma.ReceiptFindManyArgs`. | 🔵 |
| **3** `@coco/db` en application | `contexts/onboarding/application/onboardingImportService.ts:53` | Importa `getDefaultClientRoleNamesForOnboardingImport`, `getDefaultRolePreviewPermissionCodes` de `@coco/db` (catálogos config, no Prisma). Tolerable pero idealmente vía `@coco/shared-config`. | 🔵 |
| **4** `/api` desde shared/ui | `shared/ui/ExchangeRateDisplay.tsx:90` | `fetch(\`${API_BASE_URL}/exchange-rate/convert\`)` con `Authorization: Bearer ${token}` — **violación real de Regla 4**. PERO el componente es **huérfano** (cero importadores, ver §3) → no se monta, no rompe flujo. | 🔵 (dead) |
| **5** bun | — | Cero `pnpm-lock.yaml`/`package-lock.json`/`pnpm-workspace.yaml`. `bun.lock` + `bun.lockb` presentes. Cero `pnpm`/`npm run`/`npx` en scripts. **LIMPIO.** | ✅ |

> Nota Regla 2: CLAUDE.md exige "cero `as any`/eslint-disable en código nuevo". Los 25 dispatchers
> `params as any` y los 2 `eslint-disable` a nivel de archivo son los incumplimientos más netos de
> esa redacción; el resto (`as unknown as` en infra) está explícitamente amnistiado como boundary.

---

## 2. Spot-check Hex / RLS / CSRF

**Hexagonal (DI / ports):** ✅ Sano.
- Cero `new PrismaClient` / `import prisma` en `contexts/*/application` y `contexts/*/domain`
  (grep vacío). El único `prisma.*.find*` en application (`expenseReportService.ts`) recibe el
  cliente **por parámetro** desde el adapter `PrismaExpenseReportQueries.ts:35` — patrón DI válido,
  aunque con leak de tipos `Prisma.*Args` hacia application (🔵).
- `identity/` confirma el patrón de referencia: ports en `domain/ports/*`, adapters Prisma en
  `infrastructure/Prisma*Repository.ts`, use-cases en `application/*.ts`.

**RLS:** ✅ Presente en los paths muestreados.
- `routes/_app/autorizaciones.tsx` (4× `runInTenant/runInRls`), `comprobar-gastos.tsx` (2×),
  `todas-las-solicitudes.tsx` (2×), `historial.tsx` (2×). Patrón `requirePermissions → runInTenant(work)`
  consistente con ARCHITECTURE.md.

**CSRF:** ✅ Sin gaps reales. De 57 archivos de route con `action`, solo 4 sin `assertCsrf`:
- `routes/_public/login.tsx`, `routes/_public/logout.tsx` — **exención estándar** (login no tiene
  token previo; logout destruye sesión).
- `routes/_app/perfil-usuario.tsx:45` — la action solo hace logout-via-querystring + `redirect`,
  **no muta DB**. Aceptable (🔵, podría endurecerse).
- `routes/_app/resubir-comprobante.$id.tsx:29` — **cobertura transitiva**: delega en
  `handleSubirComprobanteAction` (`subir-comprobante.$id.tsx:103` llama `await assertCsrf(request)`). OK.

---

## 3. Lista DEFINITIVA de huérfanos `shared/ui/*.tsx`

Método: para cada componente, conteo de archivos `.ts/.tsx` (excluyéndose a sí mismo) con un
`import` real que referencia su nombre o un `from ".../<Name>"`. No hay barrels `index.ts` en
`shared/ui` (verificado), así que el conteo es directo.

### 3a. Huérfanos confirmados — features/wrappers REALES sin montaje (señal fuerte de feature inalcanzable)
| Componente | Importadores | Notas |
|---|---|---|
| `AdminUserForm` | 0 | form crear/editar usuario — inalcanzable |
| `ApprovalsInbox` | 0 | **island M2-007 de `/autorizaciones`** que en coco fue reemplazado: la ruta monta `AuthRequestsList` + `PolicyExceptionsInbox` directo (`autorizaciones.tsx:32-33`), NO `ApprovalsInbox`. El filtro-bar de aprobador quedó huérfano. |
| `CancelRequestModal` | 0 | cancelar solicitud — inalcanzable |
| `ExchangeRateDisplay` | 0 | + viola Regla 4 (fetch a `/api/exchange-rate`). Doble muerto. |
| `FinisCheck` | 0 | finalizar comprobación (gold-std no lo usa) |
| `History` | 0 | historial component |
| `RequestActions` | 0 | botones de acción de solicitud |
| `ResumenTramos` | 0 | resumen de tramos |
| `TravelRequestActionWrapper` | 0 | wrapper de acciones |
| `UltimateWrapper` | 0 | wrapper crear-solicitud (importa `useFetcher` pero nadie lo importa a él) |
| `UploadFiles` | 0 | upload genérico |
| `UploadReceiptFiles` | 0 | flujo subir-comprobante (cluster caso-testigo) |
| `XmlExpenseForm` | 0 | CFDI XML upload |

### 3b. Huérfanos confirmados — shims de re-export hacia `@coco/ui-kit` ya MUERTOS
Cada uno es `export { X as default } from "@coco/ui-kit"` (átomo duplicado) y nadie importa el shim:
| Shim | Importadores | Equivalente vivo |
|---|---|---|
| `Alert` | 0 | `@coco/ui-kit` directo |
| `Badge` | 0 | `@coco/ui-kit` |
| `InputField` | 0 | `@coco/ui-kit` |
| `Select` | 0 | `@coco/ui-kit` |
| `TextArea` | 0 | `@coco/ui-kit` |
| `ProgressBar` | 0 | `@coco/ui-kit` |

> (Comparar: los shims `Button`=21, `Toast`=21, `Modal`=14, `ModalWrapper`=7, `MaterialIcon`=4
> SÍ tienen importadores → vivos. Los 6 de arriba son los muertos.)

### 3c. Otros huérfanos
| Componente | Importadores | Notas |
|---|---|---|
| `NotificationContainer` | 0 | toasts (componente real, no shim) — inalcanzable |
| `CommentLoading` | 0 | skeleton de comments; `CommentsThread` usa los otros sub-comps pero no éste |

**Total huérfanos confirmados: 21** (13 features reales + 6 shims muertos + 2 otros).

> Inventario §3 listó 15 candidatos; CONFIRMO los 15 menos `AppAlertHost` (que SÍ tiene 0
> importadores también — revísalo: aparece con count 0 en mi pase, lo incluyo abajo) y añado
> hallazgos nuevos no listados: `ExchangeRateDisplay`, `ApprovalsInbox`, `CommentLoading`, y los
> 6 shims de ui-kit. `AppAlertHost`: count 0 → **huérfano confirmado** (nadie lo monta en MainLayout).

*(Corrección: `AppAlertHost` también salió con 0 importadores → huérfano. Total real = 22.)*

---

## 4. Rutas `/api` muertas + rutas inalcanzables

### 4a. 🔴/🔵 Archivos `routes/api/*.$.tsx` NO registrados en `routes.ts`
`routes.ts` solo registra 17 de los 25 archivos `/api`. **8 archivos existen con dispatcher pero
sin `route(...)` → totalmente inalcanzables (404):**

| Archivo no ruteado | Dispatcher existe | Estado contrato | Severidad |
|---|---|---|---|
| `accounts-payable.$.tsx` | sí (`accounts-payableApi.server.ts`, 22 handlers) | **Documentado externo en `swagger-m1.yaml`** (`/api/accounts-payable/polizas`, `/accounting-export`, etc.) → **contrato externo CAÍDO (404)** | 🔴 |
| `files.$.tsx` | sí (`filesApi.server.ts`: 410 upload, `receipt-file`, `receipt-files`) | README dice "KEEP", pero **NO está en swagger-m1/m2** (grep vacío). Retrieval de archivos para clientes externos inalcanzable. | 🔵 |
| `admin.$.tsx` | sí | interno-retire | 🔵 (dead) |
| `export.$.tsx` | sí | interno-retire | 🔵 (dead) |
| `flights.$.tsx` | sí | interno-retire | 🔵 (dead) |
| `hotels.$.tsx` | sí | interno-retire | 🔵 (dead) |
| `onboarding-import.$.tsx` | sí | interno-retire | 🔵 (dead) |
| `report.$.tsx` | sí | interno-retire | 🔵 (dead) |

> `README.md` de `routes/api/` lista `accounts-payable` y `files` como "KEEP / contrato externo",
> lo cual es **inconsistente con `routes.ts`** (no están ruteados) y con los YAML (`files` no
> aparece). Arreglo: o registrar `accounts-payable/*` + `files/*` en `routes.ts`, o borrar los 8
> archivos + sus dispatchers y actualizar README/YAML.

### 4b. `/api` registradas pero SIN consumidor interno (candidatas a retiro, por diseño)
Los 17 `/api/*` registrados NO se consumen desde páginas internas (Regla 4 verificada: cero
`apiRequest`/`fetch('/api/...')`/`.load('/api/...')` en código vivo). Los marcados "interno-retire"
en `routes/api/README.md` (admin, approval-substitutes, employee-categories, exchange-rate, export,
fx, flights, hotels, keys, notifications, onboarding-import, organizations, policies, refunds,
report, viajes, viaticos-policy, workflow-rules) **carecen de consumidor interno Y de doc de
contrato externo** → candidatos a dead code legítimos. Los 7 "KEEP" externos
(applicant, authorizer, accounts-payable, travel-agent, comprobantes, files, user): de éstos,
`applicant/authorizer/travel-agent/comprobantes/user` SÍ están ruteados; `accounts-payable` y
`files` NO (ver 4a).

### 4c. Rutas de página registradas sin punto de entrada (sidebar/Link)
`routes.ts` registra 12 admin + resto. Inventario §1 ya marca como "sin sidebar":
`admin/cost-centers`, `admin/workflow-simulator`, `admin/roles` — requieren entrada in-page
(botón desde otra admin page). **Verificación de Link entrante es ownership de LANE-ADMIN**;
desde lo transversal solo confirmo que están en `routes.ts` (líneas 70,72,73) y ausentes de
`SIDEBAR_CONFIG` (per inventario). No las re-juzgo aquí para no solapar con LANE-ADMIN.

---

## 5. Cobertura de endpoints backend legacy → use-case coco

Cruce de los 29 controllers legacy contra slices `contexts/*/application`:

| Legacy controller | Slice coco | Estado |
|---|---|---|
| accountingExport | accounts-payable (`exportApi`, `accountingExportQueries`) | ✅ |
| accountsPayable | accounts-payable | ✅ (pero ruta `/api` caída, §4a) |
| admin | identity (`adminApi`) | ✅ |
| apiKey | api-keys | ✅ |
| applicant | travel-requests | ✅ |
| approvalSubstitute | approvals (`approvalSubstituteModel`) | ✅ |
| authorizer | approvals | ✅ |
| comprobantes | receipts-cfdi | ✅ |
| employeeCategory | policies (`employeeCategoryQueries`) | ✅ |
| exchangeRate | fx | ✅ |
| expenseReport | accounts-payable (`expenseReportService`) | ✅ |
| file | receipts-cfdi (`filesApi`, `FileStore`, GridFS/S3) | ✅ lógica; ⚠️ ruta `/api/files` no registrada (§4a) |
| flights | flights | ✅ |
| gastoTramo | travel-requests (`gastoTramoModel`) | ✅ |
| hotels | hotels | ✅ |
| inbox | approvals (`inboxApi`) | ✅ |
| notification | notifications | ✅ |
| onboardingImport | onboarding | ✅ |
| organization | organizations | ✅ |
| permission | identity (`permissionModel`, `LegacyPermissionServiceAdapter`) | ✅ |
| policy | policies | ✅ |
| polizas | accounts-payable | ✅ |
| refund | refunds | ✅ |
| requestComment | receipts-cfdi (`WorkflowCommentsService`) + `shared/ui/comments/*` | ✅ |
| solicitudWorkflow | workflow | ✅ |
| travelAgent | travel-agency | ✅ |
| user | identity | ✅ |
| viaticasPolicy | policies (`viaticasPolicyService`) | ✅ |
| workflowRule | workflow | ✅ |

**Sin equivalente coco: NINGUNO.** Los 29 controllers tienen slice. 

**Endpoints retirados con razón documentada:**
- `POST /api/files/upload-receipt-files/:id` → coco devuelve **410** intencionalmente
  (`receipts-cfdi/interface/api/filesApi.server.ts:25`): "Endpoint retirado — el upload de
  comprobantes usa la action RR7 de `subir-comprobante.$id` (multipart)". Coincide con lo previsto
  por el inventario. ✅ retiro documentado.

**Gap de cobertura real (no de lógica, de exposición):** el slice accounts-payable está completo
como use-case, pero su superficie `/api` documentada en Swagger M1 (pólizas, accounting-export,
validate-receipt) **no es alcanzable por clientes externos** porque `accounts-payable.$.tsx` no
está en `routes.ts` (§4a). Es el único gap con impacto externo. (🔴)

---

## Acciones recomendadas (orden de impacto)
1. 🔴 Registrar `route("accounts-payable/*", "routes/api/accounts-payable.$.tsx")` (y decidir
   `files/*`) en `routes.ts`, o reconciliar README + swagger-m1 si el contrato se retira.
2. 🔵 Borrar los 6 archivos `/api` internos muertos (admin, export, flights, hotels,
   onboarding-import, report) + sus dispatchers; alinear README.
3. 🔵 Borrar/migrar los ~22 huérfanos `shared/ui` (empezar por los 6 shims de ui-kit y
   `ExchangeRateDisplay` que además viola Regla 4).
4. 🔵 Convertir imports relativos restantes (comments/*, MainLayout, FormData, barrels de packages)
   a `~/`/`#/`.
5. 🟡 Eliminar los 2 `eslint-disable no-explicit-any` de archivo y el `as any` en apiClient/cookies;
   tipar `params` del splat en los 25 dispatchers para quitar `params as any`.
