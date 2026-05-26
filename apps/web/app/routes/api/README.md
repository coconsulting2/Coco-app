# `/api/*` resource routes — contrato externo

Estos resource routes existen para **consumidores externos** del contrato
Swagger M1/M2 (`apps/web/openapi/swagger-m1.yaml` y `swagger-m2.yaml`).
**Páginas internas de coco-app NO los consumen** — usan loaders/actions de
React Router 7 directamente sobre los use-cases del slice. La regla está
enforced en `eslint.config.js`:

```js
files: ["apps/web/app/routes/_app/**", "apps/web/app/shared/ui/**"],
// prohíbe apiRequest y fetch('/api/...') dentro de páginas internas
```

## Endpoints públicos (Swagger M1/M2) — KEEP

Todos REGISTRADOS en `app/routes.ts` dentro del bloque `...prefix("api", [ … ])`.
Un dispatcher KEEP sin entrada en `routes.ts` → 404 para clientes externos
(este fue el caso de `accounts-payable.$.tsx` y `files.$.tsx`, ya corregido).

| File | Dispatcher | Documentado en | Registrado en `routes.ts` |
|---|---|---|---|
| `applicant.$.tsx` | `dispatchApplicantApi` | swagger-m2 | ✅ `applicant/*` |
| `authorizer.$.tsx` | `dispatchAuthorizerApi` | swagger-m2 | ✅ `authorizer/*` |
| `accounts-payable.$.tsx` | `dispatchAccountsPayableApi` | swagger-m1 + m2 | ✅ `accounts-payable/*` |
| `travel-agent.$.tsx` | `dispatchTravelAgentApi` | swagger-m1 | ✅ `travel-agent/*` |
| `comprobantes.$.tsx` | `dispatchComprobantesApi` | swagger-m1 | ✅ `comprobantes/*` |
| `files.$.tsx` | `dispatchFilesApi` | swagger-m1 | ✅ `files/*` |
| `user.$.tsx` | `dispatchUserApi` | swagger-m2 | ✅ `user/*` |

Tipos generados desde estos YAML: `@coco/contracts` (regenerar con
`bun --filter @coco/contracts generate` tras cualquier cambio al YAML).

## Endpoints internos — RETIRAR cuando ningún consumer interno los referencie

Estos existen históricamente porque la app se hacía round-trip a sí misma.
A medida que las páginas se migran a loaders/actions, cada uno se vuelve
elegible para retiro:

```
approval-substitutes.$.tsx
employee-categories.$.tsx
exchange-rate.$.tsx
fx.$.tsx
keys.$.tsx
notifications.$.tsx
organizations.$.tsx
policies.$.tsx
refunds.$.tsx
viajes.$.tsx
viaticos-policy.$.tsx
workflow-rules.$.tsx
```

**Retirados (2026-05-25, Fase D):** `admin.$.tsx`, `export.$.tsx`,
`flights.$.tsx`, `hotels.$.tsx`, `onboarding-import.$.tsx`, `report.$.tsx` —
no estaban registrados en `routes.ts` (404), sin consumer interno ni doc de
contrato externo. Borrados junto con sus dispatchers
(`adminApi.server`, `exportApi.server`, `flightsApi.server`, `hotelsApi.server`,
`onboarding-importApi.server`, `reportApi.server`). Los use-cases de slice
subyacentes permanecen intactos.

**Procedimiento de retiro:**

1. Migrar el consumer interno (ej. `crear-solicitud.tsx`'s child component
   `TravelRequestForm`) a loader + action.
2. `grep -rln 'apiRequest.*/applicant/...' apps/web/` debe devolver 0.
3. Eliminar el archivo `apps/web/app/routes/api/<X>.$.tsx` y su dispatcher
   en `apps/web/app/contexts/<slice>/interface/api/<X>Api.server.ts`.
4. Si el use-case es solo interno tras la migración, considerarlo "private to
   the slice" — su public API se reduce a lo que invocan las routes.

## Anti-patterns

- **NO** consumir estos `/api/*` desde código de apps/web.
- **NO** agregar nuevos `/api/*.$.tsx` sin actualizar el YAML correspondiente
  + regenerar `@coco/contracts`.
- **NO** quitar endpoints "kept" sin alinear con stakeholders del contrato
  externo (rompe SDKs / clients de terceros).
