/**
 * @module @coco/db/tenant-extension
 * @description Prisma Client Extension que aplica tenant scoping automático:
 *   1. Inyecta `where.organizationId = ctx.organizationId` en lecturas.
 *   2. Inyecta `data.organizationId = ctx.organizationId` en mutaciones.
 *   3. Si no hay contexto activo, NO inyecta — el llamador es responsable.
 *
 * Lista TENANT_SCOPED_MODELS sincronizada con schema.prisma. La columna física
 * es `organization_id` para modelos nuevos, `org_id` para modelos legacy M2-006
 * (EmployeeCategory, TravelPolicy, ReimbursementTimeLimit, WorkflowRule, Proveedor)
 * — Prisma client expone `organizationId` en ambos.
 */
import { Prisma } from "@prisma/client";
import { getTenantContext } from "#/tenant.js";

export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  "user", "department", "role", "alertMessage", "receiptType",
  "request", "solicitudHistorial", "alert", "route", "routeRequest",
  "receipt", "cfdiComprobante", "gastoTramo",
  "notification", "userPreference", "pushSubscription",
  "permissionGroup", "userPermission", "userPermissionGroup",
  "employeeCategory", "travelPolicy", "reimbursementTimeLimit", "workflowRule",
  "policyException", "proveedor", "approvalSubstitute",
  "chartOfAccount", "accountingDocType", "accountingSociety", "accountingPoliza",
  "empleado", "anticipoPolizaSnapshot",
  "organizationIntegration", "notificationTemplate",
  "apiKey",
]);

const READ_OPS: ReadonlySet<string> = new Set([
  "findUnique", "findUniqueOrThrow",
  "findFirst", "findFirstOrThrow",
  "findMany", "count", "aggregate", "groupBy",
]);

const WRITE_OPS: ReadonlySet<string> = new Set([
  "create", "createMany", "upsert",
  "update", "updateMany", "delete", "deleteMany",
]);

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

type ScopingInput = {
  model: string;
  operation: string;
  args: AnyArgs | undefined;
  ctx: { organizationId: bigint; bypassTenant?: boolean } | null;
};

/** Lógica pura de inyección — exportada para tests. */
export function applyTenantScopingToArgs({
  model,
  operation,
  args,
  ctx,
}: ScopingInput): AnyArgs | undefined {
  if (!ctx) return args;
  if (ctx.bypassTenant) return args;
  if (!TENANT_SCOPED_MODELS.has(model)) return args;

  const orgId = ctx.organizationId;
  const a: AnyArgs = args ?? {};

  if (READ_OPS.has(operation)) {
    return injectWhere(a, "organizationId", orgId);
  }
  if (!WRITE_OPS.has(operation)) {
    return a;
  }
  if (operation === "create") {
    return ensureCreateOrgId(a, orgId);
  }
  if (operation === "createMany") {
    return ensureCreateManyOrgId(a, orgId);
  }
  if (operation === "upsert") {
    const scoped = injectWhere(a, "organizationId", orgId);
    if (scoped.create && (scoped.create as Record<string, unknown>).organizationId === undefined) {
      scoped.create = { organizationId: orgId, ...scoped.create };
    }
    return scoped;
  }
  return injectWhere(a, "organizationId", orgId);
}

export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: "coco-tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const modelDelegate = model.charAt(0).toLowerCase() + model.slice(1);
          const ctx = getTenantContext();
          const scopedArgs = applyTenantScopingToArgs({
            model: modelDelegate,
            operation,
            args: args as AnyArgs | undefined,
            ctx,
          });
          // applyTenantScopingToArgs preserva el shape de args (solo inyecta
          // organizationId en where/data). Cast a typeof args es seguro: la
          // función no cambia el tipo, solo agrega campos opcionales.
          return query(scopedArgs as typeof args);
        },
      },
    },
  }),
);

function injectWhere(args: AnyArgs, key: string, value: bigint): AnyArgs {
  const where = (args.where ?? {}) as Record<string, unknown>;
  if (where[key] === undefined) {
    args.where = { ...where, [key]: value };
  }
  return args;
}

function ensureCreateOrgId(args: AnyArgs, orgId: bigint): AnyArgs {
  const data = (args.data ?? {}) as Record<string, unknown>;
  if (data.organizationId === undefined) {
    args.data = { organizationId: orgId, ...data };
  }
  return args;
}

function ensureCreateManyOrgId(args: AnyArgs, orgId: bigint): AnyArgs {
  const data = args.data;
  if (Array.isArray(data)) {
    args.data = data.map((d) =>
      (d as Record<string, unknown>).organizationId === undefined
        ? { organizationId: orgId, ...d }
        : d,
    );
  } else if (data && typeof data === "object" && (data as Record<string, unknown>).organizationId === undefined) {
    args.data = { organizationId: orgId, ...(data as Record<string, unknown>) };
  }
  return args;
}
