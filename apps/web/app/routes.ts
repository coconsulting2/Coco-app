/**
 * @file app/routes.ts
 * @description Config-based routing para React Router v7. TODA la app
 * registrada — pages + resource routes /api/* + 404 catch-all.
 *
 * Estado de migración por slice/fase: ver CLEANUP_PLAN.md.
 */
import { type RouteConfig, layout, prefix, route } from "@react-router/dev/routes";

export default [
  // ─── Public ────────────────────────────────────────────────────────────
  route("/", "routes/_public/index.tsx"),
  route("/login", "routes/_public/login.tsx"),
  route("/logout", "routes/_public/logout.tsx"),

  // ─── App (auth gating en _layout) ─────────────────────────────────────
  layout("routes/_app/_layout.tsx", [
    // Core
    route("/dashboard", "routes/_app/dashboard.tsx"),
    route("/perfil-usuario", "routes/_app/perfil-usuario.tsx"),
    route("/notificaciones", "routes/_app/notificaciones.tsx"),

    // Identity (admin user CRUD)
    route("/crear-usuario", "routes/_app/crear-usuario.tsx"),
    route("/editar-usuario/:id", "routes/_app/editar-usuario.$id.tsx"),

    // Travel requests — solicitante
    route("/historial", "routes/_app/historial.tsx"),
    route("/solicitudes-draft", "routes/_app/solicitudes-draft.tsx"),
    route("/crear-solicitud", "routes/_app/crear-solicitud.tsx"),
    route("/editar-solicitud/:id", "routes/_app/editar-solicitud.$id.tsx"),
    route("/completar-draft/:id", "routes/_app/completar-draft.$id.tsx"),
    route("/detalles-solicitud/:id", "routes/_app/detalles-solicitud.$id.tsx"),
    route("/reembolso", "routes/_app/reembolso.tsx"),

    // Approvals — N1/N2
    route("/autorizaciones", "routes/_app/autorizaciones.tsx"),
    route("/aprobaciones", "routes/_app/aprobaciones.tsx"),
    route("/solicitudes-autorizador", "routes/_app/solicitudes-autorizador.tsx"),
    route("/autorizar-solicitud/:id", "routes/_app/autorizar-solicitud.$id.tsx"),

    // Receipts/CFDI
    route("/subir-comprobante/:id", "routes/_app/subir-comprobante.$id.tsx"),
    route("/resubir-comprobante/:id", "routes/_app/resubir-comprobante.$id.tsx"),
    route("/comprobar-gastos", "routes/_app/comprobar-gastos.tsx"),
    route("/comprobar-gastos/:id", "routes/_app/comprobar-gastos.$id.tsx"),
    route("/comprobar-solicitud/:id", "routes/_app/comprobar-solicitud.$id.tsx"),

    // Travel agency
    route("/atenciones", "routes/_app/atenciones.tsx"),
    route("/atender-solicitud/:id", "routes/_app/atender-solicitud.$id.tsx"),

    // Accounts payable
    route("/todas-las-solicitudes", "routes/_app/todas-las-solicitudes.tsx"),
    route("/cotizaciones", "routes/_app/cotizaciones.tsx"),
    route("/cotizar-solicitud/:id", "routes/_app/cotizar-solicitud.$id.tsx"),
    route("/comprobaciones", "routes/_app/comprobaciones.tsx"),
    route("/exportar-contable", "routes/_app/exportar-contable.tsx"),

    // Admin
    ...prefix("admin", [
      route("/expense-policies", "routes/_app/admin/expense-policies.tsx"),
      route("/employee-categories", "routes/_app/admin/employee-categories.tsx"),
      route("/refund-time-limits", "routes/_app/admin/refund-time-limits.tsx"),
      route("/organizations", "routes/_app/admin/organizations.tsx"),
      route("/onboarding-import", "routes/_app/admin/onboarding-import.tsx"),
      route("/catalogo-contable", "routes/_app/admin/catalogo-contable.tsx"),
      route("/indicadores-impuesto", "routes/_app/admin/indicadores-impuesto.tsx"),
      route("/mapeo-gastos", "routes/_app/admin/mapeo-gastos.tsx"),
      route("/cost-centers", "routes/_app/admin/cost-centers.tsx"),
      route("/workflow-rules", "routes/_app/admin/workflow-rules.tsx"),
      route("/workflow-simulator", "routes/_app/admin/workflow-simulator.tsx"),
      route("/roles", "routes/_app/admin/roles.tsx"),
    ]),

    // Reportes
    route("/reportes/gastos-por-centro", "routes/_app/reportes/gastos-por-centro.tsx"),
  ]),

  // ─── Resource routes (API) ───────────────────────────────────────────
  // Conservados para componentes legacy que consumen vía apiClient + contrato OpenAPI.
  ...prefix("api", [
    // Fase 1
    route("user/*", "routes/api/user.$.tsx"),
    // Fase 2
    route("exchange-rate/*", "routes/api/exchange-rate.$.tsx"),
    route("fx/*", "routes/api/fx.$.tsx"),
    // Fase 3
    route("applicant/*", "routes/api/applicant.$.tsx"),
    route("authorizer/*", "routes/api/authorizer.$.tsx"),
    route("approval-substitutes/*", "routes/api/approval-substitutes.$.tsx"),
    route("workflow-rules/*", "routes/api/workflow-rules.$.tsx"),
    // Fase 4
    route("travel-agent/*", "routes/api/travel-agent.$.tsx"),
    route("comprobantes/*", "routes/api/comprobantes.$.tsx"),
    route("viajes/*", "routes/api/viajes.$.tsx"),
    // Fase 5
    route("notifications/*", "routes/api/notifications.$.tsx"),
    route("policies/*", "routes/api/policies.$.tsx"),
    route("employee-categories/*", "routes/api/employee-categories.$.tsx"),
    route("viaticos-policy/*", "routes/api/viaticos-policy.$.tsx"),
    route("refunds/*", "routes/api/refunds.$.tsx"),
    route("organizations/*", "routes/api/organizations.$.tsx"),
    route("keys/*", "routes/api/keys.$.tsx"),
  ]),

  // ─── API Docs (Swagger UI + raw YAML) ─────────────────────────────────
  // GET /api-docs           → HTML Swagger UI con selector dual M1/M2
  // GET /api-docs/<x>.yaml  → raw YAML de openapi/
  route("/api-docs/*", "routes/api-docs.$.tsx"),

  // Catch-all 404 (debe ser la última ruta)
  route("*", "routes/_public/404.tsx"),
] satisfies RouteConfig;
