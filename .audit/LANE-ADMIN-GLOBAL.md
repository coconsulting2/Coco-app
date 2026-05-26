# LANE-ADMIN+GLOBAL — Hallazgos de paridad (READ-ONLY)

> Generado: 2026-05-25 · Agente: LANE-ADMIN+GLOBAL · Método: chain-tracing estático
> (entrada → ruta → loader/action → componente montado → use-case → adapter).

## Resumen

El **núcleo CRUD de admin tiene paridad funcional muy alta**: las 12 rutas
`admin/**` están correctamente cableadas (loader con `requirePermissions` +
`runInTenant`/`runInRls`, action discriminado por `intent` con `assertCsrf`,
use-case hex del slice, componente prop-driven montado, cero `apiRequest`/`/api`
desde `shared/ui` — todas las coincidencias de `/api` son comentarios JSDoc).
Las tres rutas sin sidebar (`cost-centers`, `workflow-simulator`, `roles`)
**ganan** un punto de entrada que el legacy NO tenía: el dashboard `AdminView.tsx`
las expone como `PanelCard` — en legacy eran rutas huérfanas URL-only, así que
coco mejora la accesibilidad (no es 🔥). El bloque **GLOBAL** (layout, header,
campanita, login/logout, perfil) está bien cableado y limpio de `/api`.

**Dos regresiones reales** bajan el score: (1) `editar-usuario/:id` quedó
**sin ningún punto de entrada in-app** porque el `AdminView` de coco reemplazó
la tabla de usuarios del legacy (que tenía el link por fila) por un grid de
paneles — además se perdió la pantalla de gestión/listado de usuarios; (2) las
**preferencias de notificación** (`NotificationPreferences`, montadas en el
`perfil-usuario.astro` legacy) **no se migraron**: el componente no existe en
`shared/ui` de coco y `perfil-usuario.tsx` es solo lectura, dejando inalcanzables
los use-cases `getNotificationPreferences`/`setNotificationPreferences`/
`subscribePush` que sí existen en el slice. Adicional: `AppAlertHost` **no está
montado** en coco (sí lo estaba en `MainLayout.astro` legacy con `client:load`),
por lo que `showAppAlert()` queda muerto. Varios huérfanos confirmados.

**Paridad estimada:**
- **ADMIN:** ~85% — todo el CRUD admin completo; gap real es `editar-usuario`
  inalcanzable + pérdida del listado/gestión de usuarios.
- **GLOBAL:** ~80% — login/logout/perfil/header/sidebar/campanita OK; gaps:
  preferencias de notificación no migradas + `AppAlertHost` no montado.

**Conteo por severidad:** 🔥 0 · 🔴 3 · 🟡 1 · 🔵 5

---

## Hallazgos (ordenados por severidad)

### 🔴 1. `editar-usuario/:id` sin punto de entrada in-app (regresión)
- **Flujo:** ADMIN · editar-usuario.$id · estado 🔴
- **Evidencia:** Legacy alcanzaba la edición SOLO desde la tabla de usuarios del
  dashboard admin: `TC3005B.501-Frontend/src/views/AdminView.astro:156`
  → `<a href={`/editar-usuario/${user.user_id}`}>`. En coco, el dashboard admin
  es `contexts/identity/interface/views/AdminView.tsx` (montado en
  `routes/_app/dashboard.tsx:161`), que es un **grid de paneles** sin listado de
  usuarios ni link por fila. `grep` de `to="/editar-usuario"`/`href`/`navigate`
  en `routes`/`shared`/`contexts` → **0 resultados**. La ruta
  `routes/_app/editar-usuario.$id.tsx` está bien cableada (loader `getUserProfile`,
  action update/deactivate) pero solo se llega tecleando la URL.
- **Severidad:** 🔴 (la edición de usuario es inalcanzable por UI).
- **Fix:** Añadir una vista/listado de usuarios admin (loader → `listUsersForAdmin`,
  ya existe en `contexts/identity/index.ts:125`) con link por fila a
  `/editar-usuario/${id}`, o reintroducir esa tabla dentro de `AdminView.tsx`.

### 🔴 2. Pantalla de gestión/listado de usuarios del admin no migrada
- **Flujo:** ADMIN · gestión de usuarios (dashboard) · estado 🔴
- **Evidencia:** El `AdminView.astro` legacy era una **tabla de usuarios agrupados
  por organización** con métricas (`apiRequest('/admin/get-user-list')`,
  `views/AdminView.astro:31`). El use-case existe en coco (`listUsersForAdmin`,
  `contexts/identity/application/manageUsers.ts:187`) pero **solo es accesible vía
  el dispatcher `/api/admin/*`** (`routes/api/admin.$.tsx` → `dispatchAdminApi`);
  **ningún loader de página lo consume** (`grep listUsersForAdmin` en
  `routes`/`views` → 0). El `AdminView.tsx` de coco no lista usuarios.
- **Severidad:** 🔴 (se pierde la función central del dashboard admin del legacy).
- **Fix:** Convertir/añadir un loader de página que llame `listUsersForAdmin` y
  renderice la tabla (con link a editar-usuario), cubriendo a la vez el hallazgo #1.

### 🔴 3. Preferencias de notificación no migradas (perfil-usuario)
- **Flujo:** GLOBAL · perfil-usuario / preferencias de notificación · estado 🔴
- **Evidencia:** Legacy `pages/perfil-usuario.astro` monta `NotificationPreferences`
  (`grep` → `components/NotificationPreferences.tsx` + `pages/perfil-usuario.astro`).
  En coco, `routes/_app/perfil-usuario.tsx` es **solo lectura** (sin action de
  preferencias) y `shared/ui/NotificationPreferences.tsx` **no existe** (`ls` falla;
  `grep import NotificationPreferences` en routes → 0). Los use-cases SÍ existen sin
  consumidor de UI: `getNotificationPreferences`/`setNotificationPreferences`/
  `subscribePush`/`getVapidPublicKey` (`contexts/notifications/index.ts:57-68`).
- **Severidad:** 🔴 (feature de opt-in email/push web-push inalcanzable).
- **Fix:** Migrar `NotificationPreferences` a `shared/ui` (prop-driven) y montarlo en
  `perfil-usuario.tsx`, con loader (`getNotificationPreferences` + `getVapidPublicKey`)
  y action intent `save-preferences`/`subscribe-push` (CSRF + runInTenant).

### 🟡 4. `AppAlertHost` no montado — `showAppAlert()` muerto
- **Flujo:** GLOBAL · _layout / MainLayout / alertas modales · estado 🟡
- **Evidencia:** Legacy `layouts/MainLayout.astro:72` monta `<AppAlertHost client:load />`.
  En coco, `shared/layouts/MainLayout.tsx` y `root.tsx` **no lo renderizan**
  (`grep AppAlertHost` → solo su definición `shared/ui/AppAlertHost.tsx:28` y el
  util `shared/utils/appAlert.ts`). Cinco componentes disparan el evento sin
  oyente: `shared/ui/{AttendRequest,ExpensesForm,CxpQuoteRequest,FinisCheck}.tsx`
  (y el propio host). Los `showAppAlert()` (avisos/errores modales) **no muestran nada**.
- **Severidad:** 🟡 (degradación silenciosa de feedback al usuario; no rompe la mutación).
- **Fix:** Montar `<AppAlertHost />` una vez en `MainLayout.tsx` (equivalente al
  `client:load` legacy) o en `root.tsx`.

### 🔵 5. `AdminUserForm` huérfano (debt; legacy lo usaba)
- **Flujo:** ADMIN · crear-usuario / editar-usuario.$id · estado ✅ funcional, 🔵 debt
- **Evidencia:** Legacy montaba `AdminUserForm` en `crear-usuario.astro` y
  `editar-usuario/[id].astro`. En coco, **ambas rutas reimplementan el form inline**
  (`<Form>` + `Field`/`SelectField` locales) — `crear-usuario.tsx` y
  `editar-usuario.$id.tsx` NO importan `AdminUserForm`; `grep import AdminUserForm`
  en `routes`/`shared`/`contexts` → 0. El form inline cubre create/update/deactivate,
  así que **el flujo está completo**; `shared/ui/AdminUserForm.tsx` es dead code
  (apunta a actions `/crear-usuario` y `/editar-usuario/...` que nadie renderiza).
- **Severidad:** 🔵 (deuda — componente muerto, no afecta runtime).
- **Fix:** Borrar `AdminUserForm.tsx` o consolidar las rutas para reutilizarlo.

### 🔵 6. `NotificationContainer` huérfano (heredado del legacy)
- **Flujo:** GLOBAL · toasts · estado 🔵
- **Evidencia:** Sin importador en coco ni en legacy (solo auto-referencia en
  `shared/ui/NotificationContainer.tsx:76` / `components/NotificationContainer.tsx:76`).
- **Severidad:** 🔵 (dead code preexistente).
- **Fix:** Borrar, o cablearlo si se quiere paridad de toasts.

### 🔵 7. `InputField.tsx` y `ProgressBar.tsx` huérfanos (heredado del legacy)
- **Flujo:** GLOBAL · átomos de formulario · estado 🔵
- **Evidencia:** `grep import InputField`/`import ProgressBar` en
  `routes`/`shared`/`contexts` → 0 en coco; en legacy tampoco se usaba el `.tsx`
  (legacy usa `InputField.astro`; `ProgressBar` solo aparece en `config/progressBar.ts`).
- **Severidad:** 🔵 (dead code preexistente).
- **Fix:** Borrar.

### 🔵 8. `routeAccess.ts` es config muerta / sin enforcement
- **Flujo:** GLOBAL · gating de rutas por rol · estado 🔵
- **Evidencia:** `shared/config/routeAccess.ts` (roleRoutes/allWhitelistedRoutes) no
  está referenciado por ningún archivo de coco (`grep roleRoutes` → solo su propia
  definición). No hay `middleware.ts` (el legacy tenía `src/middleware.ts`). El
  gating real lo hace cada loader con `requirePermissions`. Como efecto colateral,
  `routeAccess.ts` NO lista `cost-centers`/`workflow-simulator`/`roles`, pero al no
  estar enforced **no bloquea** esas rutas (gating efectivo por permiso:
  `accounting:export`, `workflow:manage`, `role:manage_permissions`).
- **Severidad:** 🔵 (config inerte que puede confundir; no es un bloqueo de runtime).
- **Fix:** Borrar `routeAccess.ts` (y dejar el gating en loaders), o sincronizarlo
  y conectarlo a un middleware si se quiere defensa en profundidad.

### 🔵 9. Entrada a rutas sin sidebar: RESUELTO (mejora sobre legacy)
- **Flujo:** ADMIN · cost-centers / workflow-simulator / roles · estado ✅
- **Evidencia:** En **legacy** estas 3 rutas NO estaban en el sidebar
  (`types/menu-config.ts` solo lista hasta `workflow-rules`) **ni** tenían link
  in-page (`grep` de href/route → 0): eran URL-only/huérfanas. En **coco** el
  dashboard `AdminView.tsx:23,26,27` añade `PanelCard` a las tres → ahora son
  alcanzables. Las tres rutas están bien cableadas (loader+action+componente
  montado: `CostCenterAdmin`, `SimuladorWorkflow`, `RolesAdmin`, todos prop-driven
  + `useFetcher` contra su propia action, cero `/api`).
- **Severidad:** 🔵 (informativo — no es gap; coco mejora la accesibilidad).

---

## Verificaciones que PASARON (sin hallazgo)

- **CRUD admin completo y cableado** (loader `requirePermissions`+`runInTenant`/`runInRls`,
  action `assertCsrf`+intent+use-case, componente montado): `expense-policies`
  (policy:manage), `employee-categories` (policy:manage), `refund-time-limits`
  (policy:manage), `catalogo-contable`/`indicadores-impuesto`/`mapeo-gastos`/`cost-centers`
  (accounting:export), `workflow-rules`/`workflow-simulator` (workflow:manage), `roles`
  (role:manage_permissions), `organizations` (organization:list_all, Ditta — bien gated).
- **onboarding-import:** flujo preview→apply completo; file input real
  (`OnboardingImportAdmin.tsx:444` `type="file"`), intents `preview`/`apply` con
  `runInRls`, gate `user:create`, gate extra de crear-org. ✅
- **crear-usuario:** loader roles+departments, action `createUser` (CSRF+runInTenant),
  redirect a /dashboard, form inline montado, entrada desde `AdminView` panel. ✅
- **editar-usuario.$id:** action update + deactivate ambos cableados (solo le falta
  el punto de entrada — hallazgo #1). ✅ (cadena interna)
- **GLOBAL login:** `login.tsx` reusa `dispatchUserApi(login)`, propaga Set-Cookie,
  redirige; loader redirige a /dashboard si ya hay sesión; monta `LoginForm`. ✅
- **GLOBAL logout:** `_public/logout.tsx` action+loader reusan `dispatchUserApi(logout)`,
  emiten Set-Cookie de invalidación, redirigen a /login. `Logout.tsx` postea con
  `useFetcher` a `/logout` (no /api). ✅
- **GLOBAL perfil-usuario:** loader `getUserProfile` (DI, no /api), read-only. ✅
  (gap de preferencias = hallazgo #3).
- **GLOBAL campanita:** `NotificationBell` prop-driven desde el loader de `_layout`
  (`_layout.tsx:29-34` carga `listNotifications`), mark-read vía `useFetcher` a la
  action de `/notificaciones` (no /api). Sin link "ver todas" — **paridad OK** porque
  el legacy tampoco tenía página `/notificaciones` (es feature nueva de coco). ✅
- **GLOBAL layout/header/sidebar:** `MainLayout.tsx` réplica fiel del grid legacy;
  `PageHeader.tsx` monta NotificationBell+Logout+avatar→/perfil-usuario; `Sidebar.tsx`
  usa `SIDEBAR_CONFIG[role]`. ✅
- **role→menu / AdminView:** dashboard renderiza `AdminView` para `Administrador` y
  `Admin Ditta` (dashboard.tsx:125-161); `AdminView` muestra el bloque DITTA_ONLY
  (organizations) solo si `isRoot`. ✅
- **Regla 4 (/api desde routes/shared/ui):** limpio en todos los componentes admin
  y globales revisados — las coincidencias de `/api` y `apiRequest` son comentarios.
