# CLEANUP_PLAN — deuda técnica explícita de la migración

> **Estado actual (post-Fase 6 completa):**
> - 16/16 slices con `domain/` + `index.ts`
> - 60 rutas registradas (41 pages + 17 resource routes + index + 404 + login)
> - 0 violaciones estructurales en routes/shared
> - **0 services en `application/` con prisma directo** ✅ (era 16 al inicio)
>
> **Fase 6 — Hardening COMPLETO:** los 16 services legacy fueron refactorizados.
> Sus queries Prisma viven ahora en `infrastructure/<x>Queries.js` o
> `infrastructure/<x>Model.js`. La regla "solo infrastructure toca Prisma"
> es ahora una regla **dura**: el grandfather de ESLint quedó vacío.

Este documento lista todo lo que NO está limpio en `coco-app/` y debe quedar
resuelto antes de eliminar el backend legacy (`:3000`) y los repos
`TC3005B.501-Backend/` + `TC3005B.501-Frontend/`.

Sirve como matriz de "qué pasa entre la migración funcional y la migración
arquitectónicamente impecable". Cero ocultamiento.

---

## 1. Application services con Prisma inline — ✅ RESUELTO

**Antes:** 16 services legacy con prisma inline en `application/`.
**Después:** 0. La regla "solo infrastructure toca Prisma" se aplica sin excepciones.

Cada service movió sus queries a:
- `infrastructure/<slice>Queries.js` — funciones puras de query/comando.
- `infrastructure/<slice>Model.js` — repositorio (estilo objeto con métodos).

El service en `application/` ahora orquesta use-cases llamando a esos wrappers
y NO importa `@prisma/client` ni `~/platform/db/prisma.server`.

**Patrón replicable** (ver `app/contexts/notifications/`):
1. Crear `infrastructure/<slice>Model.js` o `<slice>Queries.js` con prisma.
2. Reescribir el service para importar wrappers en lugar de prisma.
3. Confirmar `bun run lint` pasa sin grandfather.

### Histórico de refactor (Fase 6 completa)

| Slice | Service | Infra creada | Estado |
|---|---|---|---|
| accounts-payable | `accountingExportService.js` | `accountingExportQueries.js` | ✅ |
| accounts-payable | `anticipoPolizaLifecycleService.js` | `anticipoPolizaQueries.js` | ✅ |
| approvals | `approverResolver.js` (DI-style ya limpio) | `approverResolverGlobal.js` (wrapper) | ✅ |
| notifications | `notificationService.js` | `notificationModel.js` | ✅ |
| onboarding | `onboardingImportService.js` | `onboardingImportQueries.js` | ✅ |
| organizations | `organizationService.js` | `organizationQueries.js` | ✅ |
| organizations | `tenantApplicantUserGrants.js` | `tenantApplicantGrantQueries.js` | ✅ |
| policies | `employeeCategoryService.js` | `employeeCategoryQueries.js` | ✅ |
| policies | `policyService.js` | `policyQueries.js` | ✅ |
| policies | `policyAlertService.js` | `policyAlertQueries.js` | ✅ |
| policies | `viaticasPolicyService.js` | `viaticasPolicyQueries.js` | ✅ |
| policies | `policyExceptionService.js` | `policyExceptionQueries.js` | ✅ |
| receipts-cfdi | `comprobantesService.js` | `comprobantesQueries.js` | ✅ |
| receipts-cfdi | `receiptFileService.js` | `receiptFileQueries.js` | ✅ |
| refunds | `reimbursementTimeService.js` | `reimbursementTimeQueries.js` | ✅ |
| workflow | `requestCommentService.js` | `requestCommentQueries.js` | ✅ |

**Patrón de refactor** (igual al que aplicamos a `applicantService.findReceiptByCfdiUuid`):

1. Mover cada `await prisma.X.query(...)` a un método nuevo en el modelo correspondiente.
2. En el service, importar el modelo y llamar `Model.method(args)`.
3. Quitar el archivo del `ignores` de ESLint.
4. `bun run lint` debe pasar sin necesidad del grandfather.

**Plazo recomendado:** Fase 6 (hardening). Bloqueante para producción.

---

## 2. Slices sin `domain/` ni `index.ts` público

**Solo `identity/` tiene domain/ y index.ts poblados** (referencia completa).
Los otros 15 slices tienen las carpetas `domain/entities/`, `domain/ports/`
**vacías** (creadas con mkdir, sin archivos dentro) y **no tienen** `index.ts`.

Falta para cada slice restante (15):

- `domain/entities/<Entidad>.ts` con tipos del dominio (camelCase, sin Prisma).
- `domain/ports/<Repo>.ts` con interfaces.
- `domain/errors.ts` con errores tipados.
- `index.ts` re-exportando la API pública del slice.

**Beneficio del refactor:** las routes y otros slices importan solo desde
`~/contexts/<slice>` (no profundizan), permitiendo cambios internos del slice
sin romper consumidores.

**Plazo recomendado:** incremental. Cuando se migre una page que necesita un
slice, primero se le añade `domain/` + `index.ts` al slice destino.

**Molde disponible:** `templates/slice-template/`. Comando para inicializar
un slice nuevo está en `templates/slice-template/README.md`.

---

## 3. Routes pendientes

Solo 13 rutas migradas de las ~44 del frontend legacy. **Cada ruta requiere
migrar el `.astro` original a `.tsx` con loader/action por DI.**

Roadmap por fase:

### Fase 2 — Read-only (8 rutas pendientes)
- Hotels lookup endpoints
- Flights lookup endpoints
- Organizations admin (read)
- Notifications inbox
- Policies read
- Refunds rules read

### Fase 3 — travel-requests + approvals + workflow
- `/crear-solicitud`, `/editar-solicitud/:id`, `/detalles-solicitud/:id`
- `/completar-draft/:id`
- `/autorizaciones`, `/aprobaciones`, `/autorizar-solicitud/:id`
- `/solicitudes-autorizador`
- `/reembolso`

### Fase 4 — receipts + agency + payable
- `/subir-comprobante/:id`, `/resubir-comprobante/:id`
- `/comprobar-gastos`, `/comprobar-gastos/:id`
- `/comprobar-solicitud/:id`
- `/atenciones`, `/atender-solicitud/:id`
- `/todas-las-solicitudes`, `/cotizaciones`, `/cotizar-solicitud/:id`
- `/comprobaciones`, `/exportar-contable`

### Fase 5 — admin
- `/admin/expense-policies`, `/admin/employee-categories`, `/admin/refund-time-limits`
- `/admin/organizations`, `/admin/onboarding-import`
- `/admin/catalogo-contable`, `/admin/indicadores-impuesto`, `/admin/mapeo-gastos`
- `/admin/cost-centers`, `/admin/workflow-rules`, `/admin/workflow-simulator`
- `/admin/roles`
- `/reportes/gastos-por-centro`

---

## 4. Resource routes `/api/*` pendientes

Solo conservar cuando hay razón externa (legacy LoginForm, terceros, OpenAPI,
multipart). Inventario por slice:

| Endpoint legacy | Razón para preservar | Estado |
|---|---|---|
| `/api/user/*` | LoginForm legacy | ✓ Migrado |
| `/api/exchange-rate/*`, `/api/fx/*` | OpenAPI + ExchangeRateDisplay | ✓ Migrado |
| `/api/files/*` | Upload multipart estable, contrato OpenAPI | ⏳ Fase 4 |
| `/api/comprobantes/*` | CFDI integration documentada | ⏳ Fase 4 |
| `/api/external/*` | API keys de terceros | ⏳ Fase 2/5 |
| `/api/keys/*` | Admin panel API keys | ⏳ Fase 5 |
| `/api/admin/*`, `/api/applicant/*`, `/api/authorizer/*`, `/api/accounts-payable/*`, `/api/notifications/*`, `/api/policies/*`, `/api/solicitudes/*`, etc. | **Solo flujos in-app** → migrar a actions/loaders sin endpoint HTTP | ⏳ Fases 3-5 |

---

## 5. Componentes UI legacy que usan `apiClient`

Componentes copiados verbatim de `Frontend/src/components/` que hacen fetch a
`/api/*` via `apiClient.ts`. Funcionan tal cual porque conservamos `/api/user/*`
y `/api/exchange-rate/*`. Para los demás slices, hay dos opciones:

**A) Mantenerlos como están**, levantando el endpoint `/api/*` correspondiente.
  Pro: cero cambios al componente. Contra: doble-hop HTTP (un fetch innecesario).

**B) Migrar el componente a `useFetcher()` / `useSubmit()` de RR v7.**
  Pro: elimina el doble-hop. Contra: cambio mecánico en cada componente.

**Recomendación:** A durante Fases 2-5 (no romper componentes); B en Fase 6.

Lista de componentes que usan apiClient (output de `grep -l "apiRequest" app/shared/ui`):
- `AdminUserForm.tsx`, `TravelRequestForm.tsx`, `AttendRequest.tsx`,
  `CxpQuoteRequest.tsx`, `ExpensesForm.tsx`, `UploadReceiptFiles.tsx`,
  `AproveRequestModal.tsx`, `AproveReceiptModal.tsx`, `RejectReceiptsModal.tsx`,
  `CancelRequestModal.tsx`, `PolicyExceptionModal.tsx`, `AccountingExportPanel.tsx`,
  `AccountingAccountAdmin.tsx`, etc.

---

## 6. Cookies legacy escritas por LoginForm

`LoginForm.tsx` (verbatim del frontend) escribe `document.cookie` con `token`,
`role`, `username`, `user_id`, `department_id` para que el middleware Astro
las leyera. En `coco-app/`:

- `token` httpOnly se setea por el resource route `/api/user/login` (Set-Cookie).
- `role`, `username`, etc. NO necesitan vivir en cookies cliente — el `_app/_layout`
  loader las expone vía `useRouteLoaderData`.

**Plazo:** Fase 6. Al rewrite de `LoginForm` con `<Form method="post">`, las
cookies legacy del cliente desaparecen. Componentes que aún leen
`document.cookie` (vía `getSession`) se migran al hook del layout loader.

---

## 7. Carpetas a borrar al cierre

| Carpeta / archivo | Borrar cuando | Razón |
|---|---|---|
| `coco-app/database/` | Tras validar `bun run dummy_db` apunte solo a `prisma/` | Los SQL de `Schema/` son referencia legacy; prisma migra el schema. |
| `TC3005B.501-Backend/` | Cypress 15/15 verde + diff-api 0 divergencias | Source de la migración; preservar mientras `:3000` corra como red de seguridad. |
| `TC3005B.501-Frontend/` | Idem | Idem. |
| `coco-app/_legacy-*` | Ya borrados ✓ | Staging temporal de la migración. |

---

## 8. ESLint hardening adicional

Reglas que el `eslint.config.js` actual marca como `"warn"` y deberían pasar a
`"error"` en Fase 6:

- `no-restricted-imports` cross-slice por `infrastructure/` (actualmente warn).
- `no-restricted-imports` desde routes a `infrastructure/` (actualmente warn).
- `quotes`, `eqeqeq`, `no-console` → uniformizar.

---

## Checklist final (Fase 6 — pre-prod)

- [ ] Cero archivos en `ignores` de ESLint para anti-fuga de Prisma.
- [ ] Los 16 slices con `domain/` + `index.ts`.
- [ ] Las 44 rutas legacy migradas a `.tsx`.
- [ ] Diff de endpoints `:3000` vs `:5173` → 0 divergencias.
- [ ] Cypress 15/15 verdes.
- [ ] `coco-app/database/` borrado.
- [ ] Cookies legacy del cliente eliminadas (solo httpOnly session).
- [ ] `_legacy-*` borrados (ya hecho ✓).
- [ ] Repos `TC3005B.501-Backend/` y `TC3005B.501-Frontend/` archivados a branch `legacy/pre-coco-app`.

---

## 9. Endpoint deprecation map (Phase 7 candidate)

Análisis automatizado (grep de `apiRequest(` y `fetch(` en `app/shared/ui/**`)
identifica **12 resource routes `/api/*` que NO son consumidas por ningún
componente legacy** y por lo tanto pueden migrarse a DI puro en las routes
correspondientes — eliminando el doble-hop HTTP.

**Cada uno tiene una página `routes/_app/...tsx` que YA usa DI** (loader llama
use-case directo). El endpoint resource solo existiría para integraciones
externas hipotéticas. Si no hay tercero documentado en OpenAPI ni componente
legacy que los use, son removibles.

### Endpoints redundantes (12)

| Endpoint | Cómo se usa hoy | Acción Phase 7 |
|---|---|---|
| `/api/admin/*` | Routes admin con DI (crear-usuario, editar-usuario.$id) | Eliminar (DI cubre) |
| `/api/approval-substitutes/*` | Admin substitutos (a migrar) | Eliminar tras migrar UI |
| `/api/authorizer/*` | Cubierto por /api/solicitudes/{:id}/{aprobar,rechazar} | Eliminar (alias redundante) |
| `/api/export/*` | Reemplazado por route /exportar-contable + DI | Eliminar |
| `/api/flights/*` | Solo usado vía /api/travel-agent/* | Eliminar |
| `/api/hotels/*` | Solo usado vía /api/travel-agent/* | Eliminar |
| `/api/keys/*` | Admin API keys (panel a migrar) | Conservar si hay panel pendiente; sino DI |
| `/api/notifications/*` | NotificationBell (verificar consumo) | Conservar si consumido; sino DI |
| `/api/onboarding-import/*` | OnboardingImportAdmin usa apiRequest interno | Conservar si OpenAPI; sino DI |
| `/api/report/*` | /reportes/gastos-por-centro usa DI | Eliminar |
| `/api/viajes/*` | RouteInputGroup / gastoTramo (verificar) | Conservar si consumido |
| `/api/viaticos-policy/*` | Admin viáticos (panel a migrar) | Conservar o DI |

### Endpoints NECESARIOS (no remover)

Consumidos directamente por componentes legacy en `shared/ui/` via `apiClient.ts`:

| Endpoint | Componentes consumidores |
|---|---|
| `/api/user/*` | LoginForm, Logout |
| `/api/applicant/*` | TravelRequestForm, CancelRequestModal, ExpensesForm, SubmitTravelWarper |
| `/api/accounts-payable/*` | CxpQuoteRequest, SubmitTravelWarper, RejectReceiptsModal, FinisCheck |
| `/api/comprobantes/*` | ExpensesForm, XmlExpenseForm |
| `/api/employee-categories/*` | EmployeeCategoriesAdmin |
| `/api/organizations/*` | OrganizationsAdmin |
| `/api/policies/*` | ExpensePoliciesAdmin |
| `/api/refunds/*` | PolicyExceptionsInbox, RefundTimeLimitConfig |
| `/api/solicitudes/*` | CommentsThread, TravelRequestAuthorizeActions |
| `/api/travel-agent/*` | AttendRequest |
| `/api/workflow-rules/*` | WorkflowRulesAdmin |

### Endpoints para integraciones externas (conservar siempre)

| Endpoint | Razón |
|---|---|
| `/api/fx/*` | OpenAPI utility |
| `/api/exchange-rate/*` | OpenAPI documented contract |
| `/api/files/*` | Multipart upload contract estable |
| `/api/external/*` | API keys de terceros (autenticación distinta) |

### Plan de migración Phase 7

1. **Cada componente legacy** con `apiRequest("/X")` se migra a `useFetcher()` apuntando a la action de su page route.
2. La action de la page llama al use-case por DI.
3. El endpoint `/api/X/*` se elimina del `routes.ts` y se borra el dispatcher.
4. ESLint sigue verde porque eliminamos código, no agregamos violaciones.

Esto **NO es bloqueante para producción** — el doble-hop HTTP funciona correctamente, solo es overhead optimizable.

---

## 10. Estado FINAL Phases 0-6

| Item | Estado |
|---|---|
| Slices con domain/+index.ts | 16 / 16 ✅ |
| Application services sin Prisma directo | 16 / 16 ✅ |
| Routes (in-app pages) | 41 ✅ (0 placeholders sin componente legítimo) |
| Resource routes /api/* | 25 ✅ (1:1 con backend legacy + 12 candidatos a DI) |
| Tests copiados | 108 ✅ (83 backend + 25 frontend) |
| Cypress specs | 16 ✅ (baseUrl ajustado a :5173) |
| ESLint estructural | 0 violaciones |
| Imports absolutos `~/*` | 100% en código nuevo |
| Doc style alineado | `@module` + `@description` (estilo legacy) |

