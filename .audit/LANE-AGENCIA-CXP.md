# LANE-AGENCIA+CXP — Parity audit (read-only)

> Auditor: LANE-AGENCIA+CXP · Fecha: 2026-05-25 · Método: static chain-tracing
> entrada→ruta→loader/action→componente montado→use-case→adapter, contra legacy
> `TC3005B.501-{Frontend,Backend}`.

## Resumen ejecutivo

**AGENCIA (~92% paridad).** El flujo de agencia es sólido de punta a punta:
`atenciones` (status 5) → `atender-solicitud/:id` con `AttendRequest` montado →
búsqueda Duffel de vuelos/hoteles + selección persistida vía use-cases hex
(`selectFlightOffer`/`selectStayOffer`) + finalizar (`markAttendedByAgency` 5→6).
Loaders/actions con CSRF + `runInRls`/`runInTenant`, cero `/api` en routes/ui.
Defectos: el `action` busca con `searchFlightOffers`/`searchStays` **crudos de
Duffel** en vez de los use-cases resilientes (`searchFlights`/`searchHotels`),
perdiendo el **fallback a mock** y el mensaje 503 de Stays-access-denied que el
legacy sí tenía (🟡). Sin notificación/correo al solicitante en el finalize (🔵).

**CXP (~78% paridad).** El núcleo de validación de comprobantes
(`comprobar-gastos/:id`) **es genuinamente gold-standard**: SAT (vigencia) + EFOS
blacklist + deadline + comentario obligatorio en reject + post a chat + sync de
status (finalize 8) automático vía lifecycle syncer. Export contable
(`exportar-contable`) y reporte por CC (`gastos-por-centro`) están al 100% y a
paridad. **PERO el sub-flujo de cotización CxP está roto**: `cotizaciones` lista
el **status equivocado (6 en vez de 4)**, por lo que las solicitudes recién
aprobadas por N2 (que descansan en status 4) **nunca aparecen** en la bandeja, y
el use-case que confirma el monto (`confirmImposedFee`) manda los casos sin
agencia a **status 7 en vez de 6**, saltándose la fase de Comprobación de gastos.
El pipeline CxP→agencia/comprobación no se puede completar tal como está cableado.

### Conteo por severidad
- 🔥 blocking: **2**
- 🔴 missing: **1**
- 🟡 incomplete: **3**
- 🔵 arch/debt: **3**

### Veredicto de huérfanos-candidatos
| Componente | Estado | Veredicto |
|---|---|---|
| `FinisCheck` | huérfano (solo definición) | Borrar. El finalize de comprobación se hace automático en `validateReceiptDecision`→lifecycle syncer (no hay botón "validar todos"). No es feature inalcanzable; es leftover. |
| `XmlExpenseForm` | huérfano (sin importador) | Leftover. La carga de CFDI/XML reachable vive en `subir-comprobante.$id` (scope SOLICITANTE) que usa `validateCfdiUpload` directo, no este componente. Borrar o confirmar con LANE-SOLICITANTE. |
| `AccountingExportPanel` | **montado** en `exportar-contable.tsx:23,132` | NO huérfano. Wired correcto, prop-driven, sin `/api`. |
| `CfdiSatBadge` | **borrado/ausente** | Borrado OK. El estatus SAT/CFDI se muestra vía `ReceiptDetailCard` (prop `cfdi`). No se necesitaba. |
| `AttendRequest` | **montado** en `atender-solicitud.$id.tsx:212,228` | NO huérfano. |
| `CxpQuoteRequest` | **montado** en `cotizar-solicitud.$id.tsx:111,124` | NO huérfano. |
| `ReceiptActions` | **montado** vía `ReceiptItem.tsx:11,40` | NO huérfano. |
| `RejectReceiptsModal` / `AproveReceiptsModal` | **montados** vía `ReceiptActions.tsx:8,9` | NO huérfanos. |
| `ValidateReceiptStatus` | huérfano (sin importador) | Leftover. La lógica de estado de validación vive inline en `ReceiptItem`/`ReceiptDetailCard`. Borrar. |

---

## Hallazgos (ordenados por severidad)

### 🔥 1. `cotizaciones` lista status 6 en vez de 4 — solicitudes post-N2 nunca aparecen
- **Flujo:** CXP · cotizaciones (entrada a cotizar-solicitud)
- **Estado:** 🔥 roto en runtime — el flujo no se puede iniciar.
- **Evidencia:**
  - `coco-app/apps/web/app/routes/_app/cotizaciones.tsx:17` → `const STATUS_IDS = [6];`
  - Legacy: `TC3005B.501-Frontend/src/pages/cotizaciones.astro:21` → `const status = 4;`
  - Seed de estatus (idéntico ambos lados) `coco-app/packages/db/prisma/seed.js:126-136`:
    1=Borrador … **4=Cotización del Viaje, 5=Atención Agencia, 6=Comprobación gastos del viaje, 7=Validación de comprobantes, 8=Finalizado**.
  - Coco aprobación N2 deja la request en **status 4** (`contexts/approvals/application/authorizeTravelRequest.ts:58,132`).
  - Ningún route coco lista status 4 (grep `STATUS_IDS`/`statusIds`/`[4]` → 0 resultados en `routes/_app/*`).
- **Impacto:** Tras aprobación N2 la solicitud queda en status 4, pero la bandeja CxP filtra status 6 → la solicitud es invisible para CxP → no se puede abrir `cotizar-solicitud` → el pipeline se detiene.
- **Fix:** `STATUS_IDS = [4]` en `cotizaciones.tsx:17` (y actualizar el comentario que dice "status 6 (Cotización del Viaje)", que también está mal etiquetado).

### 🔥 2. `confirmImposedFee` manda casos sin agencia a status 7 en vez de 6
- **Flujo:** CXP · cotizar-solicitud (confirmar imposed_fee)
- **Estado:** 🔥 divergencia de transición — salta la fase de Comprobación de gastos.
- **Evidencia:**
  - `coco-app/apps/web/app/contexts/accounts-payable/application/confirmImposedFee.ts:42` → `const nextStatusId: 5 | 7 = needsAgency ? 5 : 7;`
  - Legacy `TC3005B.501-Backend/controllers/accountsPayableController.js:63-64` → `const newStatus = (hotel || plane) ? 5 : 6;` (no-agencia → **6 Comprobación gastos**).
  - El propio puerto legacy-fiel de coco lo hace bien: `contexts/accounts-payable/application/accountsPayableService.ts:34` ("status 4 → agencia/CxP") con guard `request_status_id !== 4` (línea 49) y target 5/6 — pero la ruta NO usa este; usa `confirmImposedFee`.
- **Impacto:** una solicitud sin vuelo/hotel salta directo a status 7 (Validación de comprobantes) sin pasar por 6 (Comprobación gastos del viaje), donde el solicitante sube sus comprobantes. Se omite la captura de gastos.
- **Fix:** cambiar el tipo/valor a `5 | 6` y `needsAgency ? 5 : 6` en `confirmImposedFee.ts:16-18,42`; ajustar `ConfirmImposedFeeResult` y `CotizarActionResult` (`cotizar-solicitud.$id.tsx:58`). Idealmente unificar con `accountsPayableService.attendTravelRequest` para no mantener dos transiciones divergentes.

### 🔴 3. `confirmImposedFee` no valida que la request esté en status 4 (sin guard de estado)
- **Flujo:** CXP · cotizar-solicitud
- **Estado:** 🔴 validación faltante vs legacy.
- **Evidencia:** `confirmImposedFee.ts:30-45` sólo verifica existencia (`getAgencyNeeds`), no el estatus. Legacy `accountsPayableController.js:57-59` rechaza con 404 si `currentStatus !== 4` ("This request cannot be attended by accounts payable"). El puerto coco `accountsPayableService.ts:49` sí lo tiene, pero la ruta no lo usa.
- **Impacto:** se puede re-cotizar / re-disparar la transición sobre requests en cualquier estado (idempotencia/consistencia rota).
- **Fix:** agregar guard de estatus (==4) en `confirmImposedFee` (leer `request_status_id` en `getAgencyNeeds`) o cablear la ruta a `accountsPayableService.attendTravelRequest` que ya lo valida.

### 🟡 4. Búsqueda Duffel sin fallback resiliente ni manejo 503 (vuelos y hoteles)
- **Flujo:** AGENCIA · atender-solicitud (searchFlights / searchHotels)
- **Estado:** 🟡 degradación de robustez vs legacy.
- **Evidencia:**
  - `atender-solicitud.$id.tsx:137,156` llama `searchFlightOffers` / `searchStays` (re-exports crudos de `@coco/integrations/duffel`) en vez de los use-cases con DI `searchFlights` / `searchHotels`.
  - `packages/integrations/src/duffel/flights.ts:82` y `.../stays.ts:297`: llamada directa a Duffel **sin try/catch** → un fallo Duffel se propaga como 500 genérico.
  - Existen y funcionan pero quedan **sin usar**: `contexts/flights/application/searchFlights.ts:40-50` (fallback mock en error Duffel) y `contexts/hotels/application/searchHotels.ts` (proveedor resiliente + mapeo de 403 Stays).
  - Legacy SÍ caía a mock: `TC3005B.501-Backend/controllers/flightsController.js:42-46`; y devolvía 503 claro en Stays-access-denied: `hotelsController.js:41-46`.
- **Impacto:** cuando Duffel falla o Stays no está habilitado, el agente ve un error 500 genérico en vez del fallback-a-mock / mensaje 503 explicativo que daba el legacy.
- **Fix:** en el action, reemplazar `searchFlightOffers`→`searchFlights` y `searchStays`→`searchHotels` (use-cases del slice, ya pre-wired en `contexts/{flights,hotels}/index.ts`).

### 🟡 5. `fetchHotelRates` (rooms/tarifas) sin punto de entrada in-app
- **Flujo:** AGENCIA · atender-solicitud (hospedaje)
- **Estado:** 🟡 capacidad existe, no cableada al flujo nuevo.
- **Evidencia:** el use-case `fetchHotelRates` sólo se invoca por el dispatcher legacy `/api` (`contexts/hotels/interface/api/hotelsApi.server.ts:70`), no por el action del route. El action de `atender-solicitud` sólo tiene intents `searchHotels`/`selectHotel`. `AttendRequest.tsx:57-60` declara `rates`/`ratesFetched` pero no hay intent que las traiga; el flujo es search→select directo.
- **Impacto:** menor — `searchStays` ya devuelve ofertas con precio total, así que el flujo se completa; pero no se puede elegir cuarto/tarifa específica como el legacy con Duffel Stays (`postHotelFetchRates`). Aceptable si el modelo simplificado es intencional.
- **Fix (si se requiere paridad fina):** agregar intent `fetchHotelRates` al action cableando el use-case homónimo, y un botón "ver tarifas" en `AttendRequest`.

### 🟡 6. Etiquetas/comentarios de estatus desincronizados con el seed real
- **Flujo:** CXP · cotizaciones / comprobar-gastos.$id (doc)
- **Estado:** 🟡 confusión de mantenimiento (no rompe runtime por sí solo, pero ya causó el bug #1).
- **Evidencia:** `cotizaciones.tsx:3-4` comenta "status 6 (Cotización del Viaje)" — falso: 6 = "Comprobación gastos del viaje", 4 = "Cotización del Viaje" (seed `seed.js:130-132`).
- **Fix:** corregir comentarios a los nombres reales del catálogo al arreglar #1.

### 🔵 7. Sin notificación/correo al solicitante en finalize de agencia y confirmación de cotización
- **Flujo:** AGENCIA · markAttended · CXP · confirmImposedFee
- **Estado:** 🔵 paridad-debt (legacy era best-effort, no bloqueante).
- **Evidencia:** legacy envía `Mail()` tras `attendTravelRequest` (agencia y CxP): `travelAgentController.js`, `accountsPayableController.js:72-77,102-110`. Coco `markAttended.ts` y `confirmImposedFee.ts` no disparan correo/notificación; no hay trigger de status en la migración (`packages/db/prisma/migrations/.../migration.sql`).
- **Impacto:** el solicitante no recibe aviso del cambio de estado. En legacy era try/catch best-effort.
- **Fix:** invocar el servicio de notificaciones tras la transición (slice notifications), o confirmar que se cubre por otro mecanismo fuera de scope.

### 🔵 8. Dos implementaciones divergentes de la cotización CxP (deuda hex)
- **Flujo:** CXP · cotizar-solicitud
- **Estado:** 🔵 arch/debt — fuente de los bugs #2 y #3.
- **Evidencia:** coexisten `accountsPayableService.attendTravelRequest` (legacy-fiel: guard status 4, target 5/6) y `confirmImposedFee` (hex nuevo: sin guard, target 5/7). La ruta usa el segundo.
- **Fix:** consolidar en un único use-case hex correcto (con guard + target 5/6) y retirar el duplicado.

### 🔵 9. Componentes leftover a borrar
- **Flujo:** transversal AGENCIA/CXP
- **Estado:** 🔵 limpieza.
- **Evidencia:** `shared/ui/FinisCheck.tsx`, `shared/ui/XmlExpenseForm.tsx`, `shared/ui/ValidateReceiptStatus.tsx` — sin importador en `routes/`, `shared/`, `contexts/`. No representan features inalcanzables (sus funciones están cubiertas por otros caminos), son leftovers.
- **Fix:** borrar tras confirmación cruzada (XmlExpenseForm con LANE-SOLICITANTE).

---

## Lo que SÍ está a paridad (verificado end-to-end)

- **atenciones** (`routes/_app/atenciones.tsx`): loader status [5,9] = legacy 5 (+9 cancelados histórico), link a atender-solicitud. ✅
- **atender-solicitud/:id**: loader detalle + action por intent (searchFlights/searchHotels/selectFlight/selectHotel/finalize) con CSRF + runInRls; `AttendRequest` montado; `selectFlightOffer`/`selectStayOffer`/`markAttendedByAgency` use-cases hex con adapter Prisma; Duffel real en `@coco/integrations/duffel`. ✅ (salvo #4/#5)
- **comprobar-gastos/:id** (gold-standard CONFIRMADO): SAT SOAP real (`SatCfdiValidator`→`@coco/integrations/sat.consultarCfdiWithRetries`, WSDL SAT real), EFOS blacklist, deadline, comentario obligatorio en reject + post a chat, finalize automático a status 8 vía lifecycle syncer. CSRF + runInRls. `ReceiptItem`→`ReceiptActions`→modales montados. ✅
- **comprobaciones** (status [7,8]) → link a comprobar-gastos/:id. ✅ (= legacy 7)
- **todas-las-solicitudes**: loader `listAllCxpRequests` use-case + `CxPAllRequestsList` montado, sin /api. ✅
- **exportar-contable**: loader + action(download-json) + CSRF + runInTenant + `getAccountingPolizasInRange` (force/Sincronizado soportado); `AccountingExportPanel` montado prop-driven. `polizasToXml` existe en el servicio (igual que legacy, XML sólo a nivel servicio — la UI legacy también era JSON-only, paridad OK). ✅
- **reportes/gastos-por-centro**: loader + `getExpensesByCC` use-case + runInTenant + Form filtro fechas. ✅
- **routeAccess.ts / SIDEBAR_CONFIG**: agencia→ATENCIONES; CxP→TODAS/COTIZACIONES/COMPROBACIONES/EXPORTAR ERP/GASTO POR CC. Reachability por rol = paridad. ✅
- **routes.ts**: las 10 rutas de scope registradas. ✅
- **Regla anti-/api**: 0 `apiRequest`/`fetch('/api')`/`useFetcher().load('/api')` en routes y shared/ui de scope (sólo menciones en doc-comments). Los `href`/`src` a `/api/files/receipt-file/:id` en `ReceiptDetailCard` son el boundary legítimo de GridFS, no data interna. ✅
