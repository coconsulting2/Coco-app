/**
 * @module accounts-payableApi.server
 * @description Dispatcher /api/accounts-payable/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requireSession,
  requirePermissions,
  runInTenant,
  type ResolvedSession,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

import AccountsPayableService from "~/contexts/accounts-payable/application/accountsPayableService.js";
import AccountingExportService from "~/contexts/accounts-payable/application/accountingExportService.js";
import AccountsPayable from "~/contexts/accounts-payable/infrastructure/accountsPayableModel.js";
import AccountingPolizaModel from "~/contexts/accounts-payable/infrastructure/accountingPolizaModel.js";
import { validateReceiptDecision } from "~/contexts/receipts-cfdi/index.js";

type DispatchArgs = { request: Request; subpath: string };

type RequestBody = Record<string, unknown> | null;

type HandlerContext = {
  session: ResolvedSession;
  body: RequestBody;
  url: URL;
};

type RouteHandler = (
  m: RegExpMatchArray,
  ctx: HandlerContext,
) => Promise<unknown> | unknown;

type RouteDef = {
  method: string;
  pattern: RegExp;
  perm: string | null;
  handler: RouteHandler;
};

function resolveOrgId(session: ResolvedSession): bigint {
  return session.organizationId;
}

function asNumberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const ROUTES: RouteDef[] = [
  {
    method: "GET",
    pattern: /^polizas$/,
    perm: "accounting:export",
    handler: async (_m, { session, url }) => {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      if (toDate && !Number.isNaN(toDate.getTime())) toDate.setHours(23, 59, 59, 999);
      const rows = await AccountingPolizaModel.listForOrganization({
        organizationId: resolveOrgId(session),
        requestId: asNumberOrUndefined(url.searchParams.get("request_id")),
        from: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
        to: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
        limit: asNumberOrUndefined(url.searchParams.get("limit")) ?? 50,
      });
      return { polizas: rows };
    },
  },
  {
    method: "GET",
    pattern: /^polizas\/([\w-]+)\/export$/,
    perm: "accounting:export",
    handler: async (m, { session }) => {
      const row = await AccountingPolizaModel.findPayloadById(resolveOrgId(session), m[1]!);
      if (!row?.payload) {
        return jsonError(404, "Poliza not found", "POLIZA_NOT_FOUND");
      }
      const poliza = row.payload as { detalle?: unknown; detalles?: unknown };
      return {
        id: row.id,
        requestId: row.requestId,
        docType: row.docType,
        createdAt: row.createdAt,
        poliza: {
          ...poliza,
          detalles: poliza.detalle ?? poliza.detalles ?? [],
        },
      };
    },
  },
  {
    method: "POST",
    pattern: /^polizas\/(\d+)\/generar$/,
    perm: "accounting:export",
    handler: async (m) => AccountingExportService.generatePolizasForRequest(Number(m[1])),
  },
  {
    method: "PUT",
    pattern: /^attend-travel-request\/(\d+)$/,
    perm: "accounts_payable:attend",
    handler: async (m, { body }) =>
      AccountsPayableService.attendTravelRequest(
        Number(m[1]),
        Number(body?.imposed_fee ?? 0),
      ),
  },
  {
    method: "GET",
    pattern: /^requests$/,
    perm: "accounts_payable:attend",
    handler: async () => AccountsPayable.getAllRequests(),
  },
  {
    method: "PUT",
    pattern: /^validate-receipts\/(\d+)$/,
    perm: "receipt:validate",
    handler: async (m) =>
      AccountsPayableService.validateReceiptsAndUpdateStatus(Number(m[1])),
  },
  {
    method: "PUT",
    pattern: /^validate-receipt\/(\d+)$/,
    perm: "receipt:validate",
    handler: async (m, { session, body }) =>
      validateReceiptDecision({
        receiptId: Number(m[1]),
        decision: body?.approval === 1 ? "approve" : "reject",
        comment: (body?.comentario ?? body?.comment ?? null) as string | null,
        userId: Number(session.user.user_id),
      }),
  },
  {
    method: "GET",
    pattern: /^get-expense-validations\/(\d+)$/,
    perm: "receipt:validate",
    handler: async (m) => AccountsPayable.getExpenseValidations(Number(m[1])),
  },
  {
    method: "GET",
    pattern: /^accounting-export\/(\d+)$/,
    perm: "accounting:export",
    handler: async (m) => AccountingExportService.getPolizasForRequest(Number(m[1])),
  },
  {
    method: "GET",
    pattern: /^accounting-export$/,
    perm: "accounting:export",
    handler: async (_m, { url }) =>
      AccountingExportService.getPolizasInRange(
        new Date(url.searchParams.get("from") ?? ""),
        new Date(url.searchParams.get("to") ?? ""),
      ),
  },
];

export async function dispatchAccountsPayableApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";
  const url = new URL(request.url);

  try {
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      const session = r.perm
        ? await requirePermissions(request, r.perm)
        : await requireSession(request);
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body =
        method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () =>
        r.handler(m, { session, body, url }),
      );
      if (result instanceof Response) return result;
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown accounts-payable endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<RequestBody> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as RequestBody;
  } catch {
    return null;
  }
}
