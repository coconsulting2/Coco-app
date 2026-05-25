/**
 * @module expenseReportService
 * @description Agrega comprobantes (Receipt) por centro de costo y periodo para el
 *   dashboard M3-009. Usa el departamento del solicitante de la solicitud como CC.
 *
 *   Alcance por rol:
 *   - CxP / admin (`travel_request:view_any`, `expense:view`, `policy:manage`): toda la org.
 *   - N1 / N2 (`travel_request:authorize`): solo subordinados transitivos (cadena hacia abajo).
 *   - Resto: solo comprobantes propios.
 */
import { getSubordinatesRecursive } from "~/contexts/onboarding/application/employeeHierarchyService";
import { Prisma } from "@coco/db";
import type {
  ExpenseReportQuery,
  ExpenseReportRow,
  ExpensesByCostCenterReport,
  ReportExpenseType,
  ReportStatus,
  CostCenterBudget,
} from "~/contexts/accounts-payable/domain/ports/ExpenseReportQueries";

/**
 * Cliente Prisma inyectado por el adapter (`PrismaExpenseReportQueries`). Tipado
 * de forma estructural mínima para mantener el cliente concreto en infrastructure.
 */
export interface ExpenseReportPrismaClient {
  receipt: {
    findMany(args: Prisma.ReceiptFindManyArgs): Promise<unknown[]>;
  };
  department: {
    findMany(args: Prisma.DepartmentFindManyArgs): Promise<unknown[]>;
  };
}

/** Permisos que ven gasto de toda la organización en el reporte. */
const ORG_WIDE_REPORT_PERMISSIONS = [
  "travel_request:view_any",
  "expense:view",
  "policy:manage",
] as const;

/** IDs de estatus de solicitud (seed global `Request_status`). */
const REQUEST_STATUS_FINALIZADO = 8;

const UNASSIGNED_CC_ID = -1;

type ReportPeriod = "monthly" | "quarterly";
type ValidationLike = "Pendiente" | "Aprobado" | "Rechazado" | string;

/** Receipt con joins, tal como lo carga la consulta de agregación. */
type ReceiptWithJoins = {
  amount: number;
  validation: ValidationLike;
  submissionDate: Date | null;
  validationDate: Date | null;
  receiptType: { receiptTypeName: string | null } | null;
  request:
    | {
        userId: number | null;
        requestStatusId: number | null;
        creationDate: Date | null;
        user:
          | {
              department:
                | { departmentId: number; costsCenter: string | null; departmentName: string }
                | null;
            }
          | null;
      }
    | null;
};

/** Departamento usado como centro de costo. */
type DepartmentForBudget = {
  departmentId: number;
  costsCenter: string | null;
  departmentName: string;
};

export function mapReceiptTypeToReportCategory(
  receiptTypeName: string | null | undefined,
): ReportExpenseType {
  if (!receiptTypeName) return "OTROS";
  const n = receiptTypeName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (n.includes("vuelo") || n.includes("viaje")) return "VIAJE_NACIONAL";
  if (n.includes("hosped") || n.includes("hotel")) return "HOSPEDAJE";
  if (n.includes("comida") || n.includes("aliment")) return "ALIMENTOS";
  if (
    n.includes("transport") ||
    n.includes("caseta") ||
    n.includes("autobus") ||
    n.includes("taxi")
  ) {
    return "TRANSPORTE";
  }
  return "OTROS";
}

export function mapValidationToReportStatus(
  validation: ValidationLike,
  requestStatusId: number | null | undefined,
): ReportStatus {
  if (validation === "Rechazado") return "rejected";
  if (validation === "Pendiente") return "submitted";
  if (validation === "Aprobado") {
    if (requestStatusId === REQUEST_STATUS_FINALIZADO) return "paid";
    return "approved";
  }
  return "submitted";
}

function periodKeyForDate(d: Date, period: ReportPeriod): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (period === "quarterly") {
    const q = Math.floor(m / 3) + 1;
    return `${y}-Q${q}`;
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function queryAsStringList(q: unknown): string[] {
  if (q == null || q === "") return [];
  return Array.isArray(q) ? q.map(String) : [String(q)];
}

function queryAsIntList(q: unknown): number[] {
  const raw = queryAsStringList(q);
  return raw.map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
}

export function canViewOrganizationExpenseReport(
  permissionSet: Set<string> | undefined,
): boolean {
  if (!(permissionSet instanceof Set)) return false;
  return ORG_WIDE_REPORT_PERMISSIONS.some((code) => permissionSet.has(code));
}

/**
 * Usuarios cuyos comprobantes puede ver el actor en el reporte.
 * `null` = sin filtro (toda la organización).
 */
export async function resolveExpenseReportVisibleUserIds(
  actorUserId: number,
  permissionSet: Set<string> | undefined,
): Promise<number[] | null> {
  if (canViewOrganizationExpenseReport(permissionSet)) {
    return null;
  }

  const uid = Number(actorUserId);
  if (!Number.isFinite(uid) || uid < 1) {
    return [];
  }

  if (permissionSet instanceof Set && permissionSet.has("travel_request:authorize")) {
    return getSubordinatesRecursive(uid);
  }

  return [uid];
}

export async function buildExpensesByCostCenterReport(
  prisma: ExpenseReportPrismaClient,
  query: ExpenseReportQuery,
  organizationId: bigint | number,
  options: { visibleUserIds?: number[] | null } = {},
): Promise<ExpensesByCostCenterReport> {
  const { visibleUserIds = null } = options;
  const period: ReportPeriod = query.period === "quarterly" ? "quarterly" : "monthly";
  const fromStr = typeof query.from === "string" ? query.from : "";
  const toStr = typeof query.to === "string" ? query.to : "";
  const fromDate = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : null;
  const toDate = toStr ? new Date(`${toStr}T23:59:59.999Z`) : null;

  const filterExpenseTypes = new Set(queryAsStringList(query.expenseType));
  const filterStatuses = new Set(queryAsStringList(query.status));
  const filterCcIds = queryAsIntList(query.costCenterId);

  const orgId = organizationId;

  const dateFilter =
    fromDate && toDate && !Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())
      ? { gte: fromDate, lte: toDate }
      : undefined;

  const receipts = (await prisma.receipt.findMany({
    where: {
      organizationId: orgId,
      requestId: { not: null },
      ...(dateFilter ? { submissionDate: dateFilter } : {}),
    },
    include: {
      receiptType: true,
      request: {
        include: {
          user: {
            include: { department: true },
          },
        },
      },
    },
    orderBy: { submissionDate: "asc" },
  })) as ReceiptWithJoins[];

  const departments = (await prisma.department.findMany({
    where: { organizationId: orgId, active: true, costsCenter: { not: null } },
    select: {
      departmentId: true,
      costsCenter: true,
      departmentName: true,
    },
  })) as DepartmentForBudget[];

  const budgets: CostCenterBudget[] = departments.map((d) => ({
    cost_center_id: d.departmentId,
    cost_center_code: d.costsCenter ?? "",
    cost_center_name: d.departmentName,
    budget: 0,
    spent: 0,
  }));

  const rows: ExpenseReportRow[] = [];

  for (const r of receipts) {
    const req = r.request;
    if (!req) continue;

    if (visibleUserIds !== null) {
      const applicantId = req.userId;
      if (applicantId == null || !visibleUserIds.includes(Number(applicantId))) {
        continue;
      }
    }

    const dept = req.user?.department;
    let cost_center_id: number;
    let cost_center_code: string;
    let cost_center_name: string;
    if (dept && dept.costsCenter) {
      cost_center_id = dept.departmentId;
      cost_center_code = dept.costsCenter;
      cost_center_name = dept.departmentName;
    } else {
      cost_center_id = UNASSIGNED_CC_ID;
      cost_center_code = "—";
      cost_center_name = "Sin centro de costos";
    }

    const expense_type = mapReceiptTypeToReportCategory(r.receiptType?.receiptTypeName);
    const status = mapValidationToReportStatus(r.validation, req.requestStatusId);

    if (filterExpenseTypes.size > 0 && !filterExpenseTypes.has(expense_type)) continue;
    if (filterStatuses.size > 0 && !filterStatuses.has(status)) continue;
    if (filterCcIds.length > 0 && !filterCcIds.includes(cost_center_id)) continue;

    const sub = r.submissionDate ?? r.validationDate ?? req.creationDate;
    if (!sub || Number.isNaN(sub.getTime())) continue;

    rows.push({
      cost_center_id,
      cost_center_code,
      cost_center_name,
      period: periodKeyForDate(sub, period),
      amount: Number(r.amount) || 0,
      expense_type,
      status,
    });
  }

  const ccIdsInRows = new Set(rows.map((row) => row.cost_center_id));
  const scopedBudgets =
    visibleUserIds === null
      ? budgets
      : budgets.filter((b) => ccIdsInRows.has(b.cost_center_id));

  return {
    generated_at: new Date().toISOString(),
    scope: visibleUserIds === null ? "organization" : "team",
    team_member_count: visibleUserIds === null ? null : visibleUserIds.length,
    rows,
    budgets: scopedBudgets,
  };
}
