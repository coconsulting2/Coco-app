/**
 * @module @coco/db
 * @description Public API del paquete database. Expone Prisma client (con
 * tenant scoping aplicado), AsyncLocalStorage para multi-tenant context,
 * y helpers RLS para Postgres.
 *
 * Quien necesite componer extensiones adicionales (trigger-extension de dominio
 * en apps/web) importa `prismaBase` y aplica $extends manualmente.
 */
export {
  prisma,
  prismaBase,
  connectPostgres,
  disconnectPostgres,
  resetPostgres,
  type ExtendedPrismaClient,
} from "#/client.js";

export {
  withTenantContext,
  getTenantContext,
  tenantStorage,
  type TenantContext,
} from "#/tenant.js";

export {
  tenantExtension,
  applyTenantScopingToArgs,
  TENANT_SCOPED_MODELS,
} from "#/tenant-extension.js";

export {
  applyRlsSetting,
  clearRlsSetting,
  withRls,
  type RlsTransaction,
} from "#/rls.js";

// Re-export del helper de runtime que vive en seedHelpers (capability merge
// "Solicitante" por tenant — usado por permission-service y por seeds).
export {
  ensureApplicantGroupsForRole,
  APPLICANT_DEFAULT_GROUP_NAMES,
} from "#/seedHelpers/applicantRoleGroups.js";

// Bootstrap helpers de organización (usados por organizationService al
// crear orgs nuevas, además del seed inicial).
export {
  bootstrapOrganizationCatalogs,
  ensureOrganizationAdmin,
  getDefaultClientRoleNamesForOnboardingImport,
  getDefaultRolePreviewPermissionCodes,
} from "#/seedHelpers/bootstrapOrganization.js";

// Re-export Prisma namespace + generated types for convenience.
export { Prisma } from "@prisma/client";
export type {
  PrismaClient,
  User,
  Request as TravelRequest,
  Receipt,
  Department,
  Role,
  Alert,
  AlertMessage,
  Route,
  RouteRequest,
  CfdiComprobante,
  GastoTramo,
  Notification,
  UserPreference,
  PushSubscription,
  PermissionGroup,
  UserPermission,
  UserPermissionGroup,
  EmployeeCategory,
  TravelPolicy,
  ReimbursementTimeLimit,
  WorkflowRule,
  PolicyException,
  Proveedor,
  ApprovalSubstitute,
  ChartOfAccount,
  AccountingDocType,
  AccountingSociety,
  AccountingPoliza,
  Empleado,
  AnticipoPolizaSnapshot,
  OrganizationIntegration,
  NotificationTemplate,
  ApiKey,
  ValidationStatus,
} from "@prisma/client";
