// @ts-nocheck — dispatcher legacy bound to pre-hex services; M9 follow-up
/**
 * @module accounts-payableApi.server
 * @description Dispatcher /api/accounts-payable/*. Réplica del controller legacy.
 * Cada loader/action de RR v7 in-app debería preferir DI directo a los
 * use-cases del slice; este resource route se conserva para compatibilidad
 * con componentes legacy y contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession, requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as accountsPayableService from "~/contexts/accounts-payable/application/accountsPayableService.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as accountingExportService from "~/contexts/accounts-payable/application/accountingExportService.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import AccountsPayable from "~/contexts/accounts-payable/infrastructure/accountsPayableModel.js";

type DispatchArgs = { request: Request; subpath: string };

const ROUTES: Array<{ method: string; pattern: RegExp; perm: string | null; handler: (m: RegExpMatchArray, ctx: any) => Promise<unknown> | unknown }> = [
  { method: "GET", pattern: /^polizas$/, perm: "accounting:export", handler: async (m, { session, body, url }) => accountingExportService.listPolizas?.() },
  { method: "GET", pattern: /^polizas\/([\w-]+)\/export$/, perm: "accounting:export", handler: async (m, { session, body, url }) => accountingExportService.exportPolizaById?.(m[1]) },
  { method: "POST", pattern: /^polizas\/(\d+)\/generar$/, perm: "accounting:export", handler: async (m, { session, body, url }) => accountingExportService.generatePolizasForRequest(Number(m[1])) },
  { method: "PUT", pattern: /^attend-travel-request\/(\d+)$/, perm: "accounts_payable:attend", handler: async (m, { session, body, url }) => accountsPayableService.attendTravelRequest(Number(m[1]), body, session.user.user_id) },
  { method: "GET", pattern: /^requests$/, perm: "accounts_payable:attend", handler: async (m, { session, body, url }) => AccountsPayable.getAllRequests() },
  { method: "PUT", pattern: /^validate-receipts\/(\d+)$/, perm: "receipt:validate", handler: async (m, { session, body, url }) => accountsPayableService.validateReceipts(Number(m[1]), body, session.user.user_id) },
  { method: "PUT", pattern: /^validate-receipt\/(\d+)$/, perm: "receipt:validate", handler: async (m, { session, body, url }) => accountsPayableService.validateReceipt(Number(m[1]), body, session.user.user_id) },
  { method: "GET", pattern: /^get-expense-validations\/(\d+)$/, perm: "receipt:validate", handler: async (m, { session, body, url }) => accountsPayableService.getExpenseValidations(Number(m[1])) },
  { method: "GET", pattern: /^accounting-export\/(\d+)$/, perm: "accounting:export", handler: async (m, { session, body, url }) => accountingExportService.getPolizasForRequest(Number(m[1])) },
  { method: "GET", pattern: /^accounting-export$/, perm: "accounting:export", handler: async (m, { session, body, url }) => accountingExportService.getPolizasInRange(new Date(url.searchParams.get('from') ?? ''), new Date(url.searchParams.get('to') ?? '')) },
];

export async function dispatchAccountsPayableApi({ request, subpath }: DispatchArgs): Promise<Response> {
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
      const body = (method !== "GET" && method !== "HEAD") ? await readJson(request) : null;
      const result = await runInTenant(session, async () => r.handler(m, { session, body, url }));
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(404, `Unknown accounts-payable endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
