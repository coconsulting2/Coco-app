# LANE-APROBADORES (N1/N2) — Hallazgos de paridad

> READ-ONLY audit. Fuente de verdad: `TC3005B.501-{Frontend,Backend}`. Target: `coco-app/apps/web/app`.

## Resumen

El dominio de aprobadores está **mayormente cableado y completable**. Las cuatro rutas
(`autorizaciones`, `aprobaciones`, `solicitudes-autorizador`, `autorizar-solicitud/:id`) están
registradas en `routes.ts`, gateadas correctamente para N1/N2 en `routeAccess.ts`, alcanzables por
sidebar (`menu-config.ts`) y/o link in-page (`TableRow` → `/autorizar-solicitud/:id`). La cadena
entry→route→loader/action→componente montado→use-case→adapter está completa y sin violaciones de
regla `/api` (el único match es un comentario). El loop de **excepciones de política** cierra de
punta a punta: el solicitante las crea vía `ExpensesForm` (montado en subir/resubir-comprobante) y el
aprobador las resuelve vía `PolicyExceptionsInbox`, montado y gateado N1/N2 en `autorizaciones.tsx`,
con permiso `expense:authorize_exception` correctamente sembrado para `TravelRequestApprover`
(`bootstrapOrganization.js:35-40`). Approve/reject de solicitud, transición N1→N2 (incl. escalado por
monto), bloqueo por excepciones pendientes y emisión de póliza AV están cubiertos en el use-case
`authorizeTravelRequest`. `reassign` es un **extra** sobre el legacy (la página legacy cableada solo
tenía Aceptar/Rechazar) y está completamente cableado.

**El único hallazgo bloqueante real:** la página `autorizar-solicitud/:id` **no renderiza el detalle
de la solicitud** — `TravelRequestAuthorizeActions` ignora la prop `request` y solo muestra 3 botones,
mientras que el legacy mostraba `RequestDetail` + comprobantes + historial. El aprobador decide a
ciegas. El flujo *técnicamente* se completa (los botones funcionan) pero rompe paridad funcional grave.

**Paridad estimada dominio aprobadores: ~85%.**

| Severidad | Conteo |
|---|---|
| 🔥 blocking | 1 |
| 🔴 missing feature | 1 |
| 🟡 incomplete | 2 |
| 🔵 arch/debt | 1 |

---

## Hallazgos (ordenados por severidad)

### 🔥 1. `autorizar-solicitud/:id` no muestra el detalle de la solicitud
- **Flujo:** autorizar-solicitud.$id (revisar y autorizar/rechazar).
- **Estado:** 🟡 carga pero incompleto funcionalmente (decisión a ciegas).
- **Evidencia:**
  - Legacy `autorizar-solicitud/[id].astro:48` → `<RequestApproval>` que renderiza
    `RequestDetail.astro` (destino, fechas, monto, presupuesto) + `RequestComprobantesSection.astro`
    (comprobantes) + historial, y un fallback de solo-lectura para roles sin permiso
    (`RequestApproval.astro:39-90`).
  - Coco `routes/_app/autorizar-solicitud.$id.tsx:165-168` pasa `request={data.request}` a
    `TravelRequestAuthorizeActions`, **pero** `shared/ui/TravelRequestAuthorizeActions.tsx:25-27`
    destructura SOLO `{ request_id }` e **ignora** `request`. La página queda con header + 3 botones,
    sin destino/fechas/monto/comprobantes/historial.
- **Severidad:** 🔥 (paridad funcional rota: el aprobador no ve qué aprueba).
- **Fix:** Renderizar el detalle en la ruta antes de las acciones (reusar el componente de detalle
  prop-driven que ya consume `detalles-solicitud.$id`), o que `TravelRequestAuthorizeActions` reciba y
  pinte `request`. ~1-2 archivos.

### 🔴 2. Sin fallback de solo-lectura para roles sin `travel_request:authorize`
- **Flujo:** autorizar-solicitud.$id, vista de no-aprobadores.
- **Estado:** 🔴 feature legacy ausente.
- **Evidencia:** Legacy `RequestApproval.astro:80-89` muestra un aviso "solo lectura" cuando
  `canAuthorize === false`, permitiendo que cualquiera con acceso a la ruta VEA la solicitud sin botones.
  En coco la ruta exige `requirePermissions(request, "travel_request:authorize")` en el loader
  (`autorizar-solicitud.$id.tsx:31`), así que un rol sin ese permiso recibe 403 en vez de la vista de
  lectura. (Impacto bajo: en `routeAccess.ts` solo N1/N2 tienen la ruta, y ambos tienen el permiso, así
  que en la práctica nadie cae en ese fallback hoy — por eso 🔴 y no 🔥.)
- **Severidad:** 🔴.
- **Fix:** Si se requiere paridad, gatear el loader con un permiso de lectura (`travel_request:view_any`)
  y condicionar el render de acciones a `travel_request:authorize`. Decisión de producto.

### 🟡 3. `solicitudes-autorizador` reutiliza la bandeja de aprobación (hereda bug legacy)
- **Flujo:** solicitudes-autorizador.
- **Estado:** 🟡 funcional pero semántica heredada de un bug legacy.
- **Evidencia:** Legacy `solicitudes-autorizador.astro:23` montaba `ApplicantView` (vista de
  solicitante, no de autorizador — probable bug). Coco `solicitudes-autorizador.tsx:5-8` documenta esto
  y en su lugar muestra `getApprovalInbox` (misma data que `autorizaciones`). Es una mejora razonable,
  pero el sidebar lista AUTORIZACIONES y SOLICITUDES como entradas separadas
  (`menu-config.ts:18-19,29-30`) que ahora muestran contenido casi idéntico → posible confusión/duplicado.
- **Severidad:** 🟡.
- **Fix:** Definir semántica distinta (p.ej. histórico de decisiones del aprobador) o fusionar entradas
  de sidebar. Decisión de producto.

### 🟡 4. `PolicyExceptionsInbox` no recarga la lista tras decidir (solo toast)
- **Flujo:** bandeja de excepciones de política (decidir aprobar/rechazar).
- **Estado:** 🟡 se completa la mutación pero la UI no refresca la tabla.
- **Evidencia:** `shared/ui/PolicyExceptionsInbox.tsx:52-72` usa `useFetcher` y al recibir `ok`
  muestra toast + cierra modal, pero **no** invalida el loader (no hay `useRevalidator` ni navegación),
  así que la fila decidida permanece visible hasta un refresh manual. El legacy
  (`PolicyExceptionsInbox.tsx:65 void load()`) sí recargaba. La decisión SÍ persiste en backend
  (`decideException` → `decideExceptionTx`), así que el flujo se completa; es defecto de feedback.
- **Severidad:** 🟡.
- **Fix:** Tras `fetcher.data.ok`, llamar `useRevalidator().revalidate()` (memoria del proyecto: refresh
  vía `useRevalidator`, no refetch a `/api`).

### 🔵 5. `reassign` (reasignación de aprobación) es feature añadida sin equivalente en la página legacy cableada
- **Flujo:** autorizar-solicitud.$id → modal "Reasignar".
- **Estado:** ✅ cableado completo (route action intent `reassign` → `reassignApproval` use-case →
  `applyWorkflowAction` persiste snapshot; `index.ts:91-92`), pero es deuda de paridad inversa.
- **Evidencia:** La página legacy cableada (`RequestApproval.astro`) **no** tenía reasignar; solo el
  componente legacy huérfano `TravelRequestAuthorizeActions.tsx:118` (que llamaba
  `PUT /solicitudes/:id/reasignar`, endpoint que conviene verificar que exista en backend legacy).
  Coco lo trae como botón visible y funcional. No es un gap de paridad (no falta nada del legacy), pero
  introduce comportamiento no presente en el legacy cableado.
- **Severidad:** 🔵 (informativo; confirmar que es feature deseada y que el endpoint legacy existía).

---

## Notas de huérfanos juzgados (candidatos del inventario)
- **`PolicyExceptionsInbox`** — NO huérfano. Montado en `autorizaciones.tsx:194`, gateado N1/N2. ✅
- **`PolicyExceptionModal`** — NO huérfano y NO es approver-side. Usado por `shared/ui/ExpensesForm.tsx`
  (lado solicitante: justificar excedente). Paridad con legacy (mismo uso en `ExpensesForm`). Dominio
  SOLICITANTE. ✅
- **`AproveRequestModal`** — NO huérfano y NO es approver-side. Usado por `atender-solicitud.$id.tsx`
  (dominio AGENCIA). Paridad con legacy (`atender-solicitud/[id].astro`). ✅
- **`PolicyAlert`** — NO huérfano. Usado por `ExpensesForm.tsx` (lado solicitante). Paridad. ✅

## Substitutos / delegación
Sin gap de paridad: el legacy **no tenía UI** de substitutos de aprobación (solo backend
`approvalSubstituteRoutes.js` + cron). Coco preserva el endpoint dispatcher
(`routes/api/approval-substitutes.$.tsx`) y el service (`approvalSubstituteService` exportado en
`approvals/index.ts:104-112`). No falta UI porque el legacy tampoco la tenía.

## Verificaciones que PASARON (paridad confirmada)
- Rutas registradas en `routes.ts:37-40`. ✅
- `routeAccess.ts` N1/N2 incluyen `/autorizaciones`, `/aprobaciones`, `/autorizar-solicitud/*`,
  `/solicitudes-autorizador`. ✅
- Permiso `expense:authorize_exception` sembrado para N1/N2 (`bootstrapOrganization.js:39`,
  `seed.js:58`). ✅
- `aprobaciones` = alias de `autorizaciones` (legacy hacía `Astro.redirect`); coco mantiene URL viva con
  misma data. ✅
- Anti-`/api` en archivos del flujo: limpio (único match = comentario en `PolicyExceptionsInbox.tsx:9`). ✅
- Mutaciones vía action intent + `assertCsrf` + `runInRls` → use-case hex (no model legacy directo).
  Confirmado en `autorizar-solicitud.$id.tsx` (approve/reject/reassign) y `autorizaciones.tsx`
  (policy-exception:decide). ✅
- Lógica backend cubierta: approve/reject (`authorizeTravelRequest`/`rejectTravelRequest`), transición
  N1→N2 + escalado por monto (`authorizeTravelRequest.ts:184-236`), bloqueo por excepciones pendientes
  (`ensureNoPendingPolicyExceptions`), gating de decisión de excepción por aprobador designado
  (`policyExceptionService.ts:124-130`), filtro de inbox por aprobador en snapshot
  (`PrismaApprovalInboxQueries.ts:57-86`, paridad con `get-approver-requests/:status`). ✅
