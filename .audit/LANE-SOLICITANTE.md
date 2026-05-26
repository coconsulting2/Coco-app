# LANE-SOLICITANTE — Hallazgos de paridad (read-only)

> Auditor: LANE-SOLICITANTE · Fecha: 2026-05-25 · Método: trazado estático de cadena
> (entry point → route → loader/action → componente montado → use-case → adapter).
> Sin runtime (docker compartido entre lanes).

## Resumen

El núcleo de creación/edición de solicitudes del Solicitante está **sólido y
100% wireado a paridad**: `crear-solicitud`, `editar-solicitud.$id`,
`completar-draft.$id`, `solicitudes-draft` (listado), `historial`,
`detalles-solicitud.$id`, `comprobar-solicitud.$id` (envío a validación) y
`reembolso` siguen el patrón gold-standard (loader prop-driven, action por
intent con `assertCsrf` + `runInRls`/`runInTenant`, use-case hex, cero
`apiRequest`/`fetch('/api/...')` en routes/shared-ui). Las rutas
`subir-comprobante.$id` y `resubir-comprobante.$id` están **internamente
impecables** (action multipart completa, use-cases CFDI/SAT, CSRF, RLS).

**El daño está en el cableado de entrada y en una feature huérfana**, todo
confirmando y ampliando el caso testigo:

1. **subir-comprobante** ha perdido su único punto de entrada "de primera vez":
   el botón **"+ Agregar comprobante"** del legacy `comprobar-solicitud` no se
   reimplementó en el componente `RequestValidationStatus`. El único acceso
   restante es `UploadSuccessCard` (que sólo aparece *después* de ya haber
   subido uno) → chicken-and-egg.
2. **resubir-comprobante** no tiene **ningún** punto de entrada (el link
   "Resubir" del legacy no existe), y además la ruta **no lee el query param
   `?replace=`** ni se lo pasa a `ExpensesForm`, así que aún forzando la URL
   el borrado del comprobante anterior no ocurre.
3. **Cancelar solicitud/borrador** quedó inalcanzable: `CancelRequestModal`
   está construido correctamente (intent=cancel vía useFetcher) y el action de
   `detalles-solicitud.$id` lo soporta, pero **el componente no lo monta nadie**;
   el ícono de papelera del dashboard ahora sólo navega al detalle (donde no hay
   botón de cancelar) y el listado de borradores perdió la papelera por completo.

**Paridad estimada del dominio Solicitante: ~78%.** Los flujos de redacción de
solicitud (la mayor superficie) están al 100%; las pérdidas se concentran en 3
puntos de entrada/feature que dejan rutas y use-cases ya construidos sin forma
de invocarse desde la UI.

---

## Hallazgos (ordenados por severidad)

### 🔥 1. `comprobar-solicitud.$id` — falta botón "+ Agregar comprobante" → subir-comprobante sin entrada de primera vez
- **Flujo:** subir-comprobante · **Estado:** 🔥
- **Evidencia:** Legacy `pages/comprobar-solicitud/[id].astro:90` renderiza
  `<a href={/subir-comprobante/${id}}> + Agregar comprobante` (gateado por
  `requestAllowsReceiptUpload`). En coco la ruta
  `routes/_app/comprobar-solicitud.$id.tsx:112` sólo monta
  `RequestValidationStatus`, cuyo render (`shared/ui/RequestValidationStatus.tsx:56-129`)
  **no contiene ningún link a `/subir-comprobante`**. El único otro acceso es
  `shared/ui/UploadSuccessCard.tsx:237`, que sólo se muestra tras una subida
  exitosa (`shared/ui/ExpensesForm.tsx:183-186`) → no hay primer acceso.
- **Severidad:** 🔥 blocking (no se puede subir el primer comprobante por UI).
- **Fix:** En `RequestValidationStatus`, agregar un `<Link to={/subir-comprobante/${requestId}}>`
  gateado por `requestAllowsReceiptUpload(receipts.requestStatusId)` (util ya
  existe en `shared/utils/receiptUploadAccess.ts`), pasando `requestId` como prop
  desde la route.

### 🔥 2. `resubir-comprobante.$id` — cero puntos de entrada (link "Resubir" ausente)
- **Flujo:** resubir-comprobante · **Estado:** 🔥
- **Evidencia:** Legacy `pages/comprobar-solicitud/[id].astro:124` renderiza
  `<a href={/resubir-comprobante/${id}?replace=${expense.receipt_id}}>` para cada
  comprobante en estado `Rechazado`. En coco, `grep -rn "resubir-comprobante"`
  no arroja **ningún** `href`/`to`/navigate en componentes — sólo la definición
  de ruta (`routes.ts:44`) y comentarios. `RequestValidationStatus` muestra el
  badge "Rechazado" (línea 90-95) pero **no añade botón Resubir**.
- **Severidad:** 🔥 blocking (un comprobante rechazado nunca puede corregirse).
- **Fix:** En `RequestValidationStatus`, por cada item con
  `item.validation === "Rechazado"` y upload permitido, renderizar
  `<Link to={/resubir-comprobante/${requestId}?replace=${item.receiptId}}>Resubir`.

### 🔥 3. Resubir no propaga `?replace=<receiptId>` → no borra el comprobante anterior
- **Flujo:** resubir-comprobante · **Estado:** 🔥 (parcial pero rompe la semántica)
- **Evidencia:** Legacy `resubir-comprobante/[id].astro` lee
  `url.searchParams.get("replace")` y lo pasa a `ExpensesForm receiptToReplace=`.
  En coco `routes/_app/resubir-comprobante.$id.tsx:24-27` el loader devuelve sólo
  `{ requestId, resubmit: true }` (no lee `params`/query) y el render
  (`:44`) monta `<ExpensesForm requestId resubmit />` **sin `receiptToReplace`**.
  `ExpensesForm` acepta esa prop y la envía en el FormData
  (`shared/ui/ExpensesForm.tsx:33,141`), y el action borra el viejo sólo si llega
  (`subir-comprobante.$id.tsx:305 if (options.resubmit && receiptToReplace ...)`).
  Sin la prop → no se borra el comprobante rechazado y quedan duplicados.
- **Severidad:** 🔥 (corrupción de datos: dos comprobantes, el rechazado nunca se reemplaza).
- **Fix:** En el loader leer `new URL(request.url).searchParams.get("replace")`,
  devolverlo, y pasarlo como `receiptToReplace={data.receiptToReplace}` al `ExpensesForm`.

### 🔥 4. Cancelar solicitud/borrador inalcanzable — `CancelRequestModal` huérfano
- **Flujo:** cancelar (dashboard + solicitudes-draft) · **Estado:** 🔥
- **Evidencia:** Legacy montaba `CancelRequestModal` en `views/ApplicantView.astro:155`
  (ícono papelera del dashboard) y `components/RequestDraft.astro:48` (papelera por
  borrador), llamando `PUT /applicant/cancel-travel-request/:id`. En coco:
  - `shared/ui/CancelRequestModal.tsx` existe y está bien hecho (intent=cancel vía
    useFetcher, sin token/API), **pero `grep -rn` confirma que ningún route/componente
    lo importa** → huérfano.
  - `contexts/.../ApplicantView.tsx:139-147` reemplazó el modal por un simple
    `<Link to={/detalles-solicitud/${id}} aria-label="Ver detalles para cancelar">`
    con ícono delete — navega, no cancela.
  - `detalles-solicitud.$id.tsx:158-170` SÍ tiene el action `intent="cancel"`
    (`cancelTravelRequest` + CSRF + runInRls), **pero el componente
    `DetallesSolicitudRoute` no renderiza ningún botón que lo dispare**.
  - `routes/_app/solicitudes-draft.tsx` no tiene papelera alguna (el legacy sí).
- **Severidad:** 🔥 blocking (no hay forma de cancelar una solicitud/borrador por UI;
  use-case + action + componente ya existen, sólo falta montarlos).
- **Fix:** Montar `<CancelRequestModal id={r.request_id}>` en `ApplicantView`
  (reemplazando el Link papelera) y en `solicitudes-draft.tsx`, o renderizar un
  botón cancelar en `DetallesSolicitudRoute` que submitee `intent=cancel`.
  (Cualquiera de las dos route ya soporta el action; draft list necesitaría añadir
  el action `cancel` a su propia route o redirigir el modal a la del detalle.)

### 🟡 5. `subir-comprobante` no gatea visibilidad por estado de solicitud en la entrada
- **Flujo:** subir-comprobante · **Estado:** 🟡 (derivado de #1)
- **Evidencia:** Legacy sólo mostraba "+ Agregar comprobante"/"Resubir" cuando
  `requestAllowsReceiptUpload(request_status_id)` (estados 4–7) y mostraba un
  mensaje explicativo en caso contrario (`comprobar-solicitud/[id].astro:90-99`).
  Al reintroducir los botones (fixes #1/#2) hay que conservar ese gating; la util
  `shared/utils/receiptUploadAccess.ts` y el use-case
  `requestAllowsReceiptUpload` ya existen pero `RequestValidationStatus` no los usa.
- **Severidad:** 🟡 (paridad de visibilidad/UX; el backend revalida igualmente).
- **Fix:** Al añadir los links de #1/#2, condicionarlos con
  `requestAllowsReceiptUpload(receipts.requestStatusId)` y mostrar el texto guía
  cuando no aplique.

### 🔵 6. Componentes huérfanos solicitante — dead code (no regresión, salvo CancelRequestModal)
- **Flujo:** transversal · **Estado:** 🔵
- **Evidencia (grep importadores en coco):**
  - **Ya muertos también en legacy (no regresión, candidatos a borrar):**
    `UploadReceiptFiles`, `UploadFiles`, `XmlExpenseForm`, `ResumenTramos`,
    `RequestActions` — sin importador ni en legacy ni en coco.
  - **Reemplazados intencionalmente por implementación inline (benignos):**
    `History.tsx` (la route `historial.tsx` renderiza la lista inline),
    `UltimateWrapper` / `TravelRequestActionWrapper` (dominio admin/aprobadores).
  - **`SubmitTravelWarper`**: el componente default no se usa, pero la route
    `subir-comprobante.$id` y `ExpensesForm` importan sus *constantes*
    (`CONCEPTO_OPTIONS`, `receiptTypeIdForConcepto`) — vivo como módulo de utilidades.
  - **`UploadSuccessCard`**: NO huérfano — lo monta `ExpensesForm.tsx:186`.
  - **`CancelRequestModal`**: huérfano pero es una **feature viva faltante**, no
    dead code → ver hallazgo #4.
- **Severidad:** 🔵 deuda/limpieza.
- **Fix:** Borrar los 5 muertos confirmados; montar `CancelRequestModal` (#4).

---

## Flujos verificados OK (sin hallazgo)

| Flujo | Estado | Evidencia |
|---|---|---|
| crear-solicitud | ✅ | `crear-solicitud.tsx` loader (cost center DI) + action intents `create`/`create-draft`, CSRF, runInRls, `createTravelRequest`/`createDraftTravelRequest`; monta `TravelRequestForm` (useFetcher, sin /api). Entrada: ApplicantView + sidebar + historial. |
| editar-solicitud.$id | ✅ | `editar-solicitud.$id.tsx` loader `getRequestDetail`+normalize, action intent `edit` → `editTravelRequest`. Entrada: ApplicantView:130 (`isEditable` = Primera Revisión, paridad). |
| completar-draft.$id | ✅ | loader normalize + action intents `edit`/`confirm` (confirm encadena server-side editar+confirmar borrador). Entrada: `solicitudes-draft.tsx:54`. |
| solicitudes-draft (listado) | ✅* | loader `listDrafts` DI. *(le falta la papelera de cancelar → cubierto en #4).* |
| historial | ✅ | loader `listCompletedRequests` DI; lista inline prop-driven; sin /api. |
| detalles-solicitud.$id | ✅* | loader detail+journey+comments+(CxP receipts); action `add-comment` + `cancel`. *(falta UI de cancelar → #4).* Comments/timeline loader-driven. |
| comprobar-solicitud.$id (envío a validación) | ✅* | loader `getReceiptsForRequestValidation`, action intent `send-for-validation` → `submitReceiptsForValidation`, CSRF+runInRls; monta `RequestValidationStatus` (useFetcher). *(le faltan los links subir/resubir → #1/#2).* |
| subir-comprobante.$id (la subida en sí) | ✅* | action multipart completa: `createExpenseValidationBatch` → discover receiptId → upload GridFS → `registerReceiptCfdi`/`registerInternationalReceipt`; intents `previewPolicy`/`policy-exception:create`/`submit`. *(inalcanzable por UI → #1).* |
| reembolso | ✅ | loader `getRefundDashboardForUser` DI; `RefundDashboard` prop-driven, sin /api. Entrada: sidebar. |

`routeAccess.ts` y `menu-config.ts` para el rol Solicitante = paridad con legacy
(incluye `/subir-comprobante/*`, `/resubir-comprobante/*`, `/comprobar-solicitud/*`,
etc.), así que el gating por rol no bloquea; el problema es exclusivamente de
puntos de entrada in-page y montaje de componentes.
