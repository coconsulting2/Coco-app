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

| File | Dispatcher | Documentado en |
|---|---|---|
| `applicant.$.tsx` | `dispatchApplicantApi` | swagger-m2 |
| `authorizer.$.tsx` | `dispatchAuthorizerApi` | swagger-m2 |
| `accounts-payable.$.tsx` | `dispatchAccountsPayableApi` | swagger-m1 + m2 |
| `travel-agent.$.tsx` | `dispatchTravelAgentApi` | swagger-m1 |
| `comprobantes.$.tsx` | `dispatchComprobantesApi` | swagger-m1 |
| `files.$.tsx` | `dispatchFilesApi` | swagger-m1 |
| `user.$.tsx` | `dispatchUserApi` | swagger-m2 |

Tipos generados desde estos YAML: `@coco/contracts` (regenerar con
`bun --filter @coco/contracts generate` tras cualquier cambio al YAML).

## Endpoints internos — RETIRAR cuando ningún consumer interno los referencie

Estos existen históricamente porque la app se hacía round-trip a sí misma.
A medida que las páginas se migran a loaders/actions, cada uno se vuelve
elegible para retiro:

```
admin.$.tsx
approval-substitutes.$.tsx
employee-categories.$.tsx
exchange-rate.$.tsx
export.$.tsx
fx.$.tsx
flights.$.tsx
hotels.$.tsx
keys.$.tsx
notifications.$.tsx
onboarding-import.$.tsx
organizations.$.tsx
policies.$.tsx
refunds.$.tsx
report.$.tsx
viajes.$.tsx
viaticos-policy.$.tsx
workflow-rules.$.tsx
```

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
