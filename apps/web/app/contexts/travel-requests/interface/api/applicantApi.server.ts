/**
 * @module applicantApi.server
 * @description Dispatcher /api/applicant/*. Conservamos este resource route
 * SOLO porque `TravelRequestForm.tsx` (componente legacy verbatim) lo consume
 * via apiClient. Para flujos in-app NUEVOS, prefiere actions/loaders en
 * `routes/_app/*.tsx` que invoquen los services por DI.
 *
 * Endpoints (réplica fiel del controller legacy):
 *   GET  /:id                                       → getApplicantById
 *   GET  /get-cc/:user_id                           → getCostCenterByUserId
 *   POST /create-travel-request/:user_id            → createTravelRequest
 *   PUT  /edit-travel-request/:user_id              → editTravelRequest
 *   PUT  /cancel-travel-request/:request_id         → cancelTravelRequest
 *   POST /create-expense-validation                 → createExpenseValidationHandler
 *   GET  /get-completed-requests/:user_id           → getCompletedRequests
 *   GET  /get-user-request/:user_id                 → getApplicantRequest (detalle)
 *   GET  /get-user-requests/:user_id                → getApplicantRequests (lista)
 *   POST /create-draft-travel-request/:user_id      → createDraftTravelRequest
 *   PUT  /confirm-draft-travel-request/:user_id/:request_id → confirmDraftTravelRequest
 *   PUT  /send-expense-validation/:request_id       → sendExpenseValidation
 *   DELETE /delete-receipt/:receipt_id              → deleteReceipt
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requirePermissions,
  requireAnyPermission,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

import * as applicantService from "~/contexts/travel-requests/application/applicantService.js";
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";

type DispatchArgs = { request: Request; subpath: string };

export async function dispatchApplicantApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0]!;

  try {
    // ── GET /:id (numeric, single segment) ────────────────────────────────
    if (method === "GET" && /^\d+$/.test(path)) {
      const session = await requirePermissions(request, "travel_request:view_own");
      const id = Number(path);
      const user = await runInTenant(session, async () => Applicant.findById(id));
      if (!user) return jsonError(404, "User not found", "USER_NOT_FOUND");
      return jsonOk(user);
    }

    // ── GET /get-cc/:user_id ──────────────────────────────────────────────
    if (method === "GET" && path.startsWith("get-cc/")) {
      const session = await requirePermissions(request, "travel_request:view_own");
      const userId = Number(path.slice("get-cc/".length));
      const cc = await runInTenant(session, async () => Applicant.findCostCenterByUserId(userId));
      if (!cc) return jsonError(404, "No cost center found", "NO_CC");
      return jsonOk(cc);
    }

    // ── POST /create-travel-request/:user_id ──────────────────────────────
    if (method === "POST" && path.startsWith("create-travel-request/")) {
      const session = await requirePermissions(request, "travel_request:create");
      await assertCsrf(request);
      const userId = Number(path.slice("create-travel-request/".length));
      const body = await readJson(request);
      const result = await runInTenant(session, async () =>
        Applicant.createTravelRequest(userId, body),
      );
      return jsonOk({ ...(result as Record<string, unknown> ?? {}), message: "Travel request created" });
    }

    // ── PUT /edit-travel-request/:user_id ─────────────────────────────────
    if (method === "PUT" && path.startsWith("edit-travel-request/")) {
      const session = await requirePermissions(request, "travel_request:edit_own");
      await assertCsrf(request);
      // El path lleva `:user_id` por compat con el contrato legacy, pero la
      // edición se identifica por `request_id` del body (el dueño se valida vía RLS).
      const body = await readJson(request);
      const requestId = Number(body?.request_id);
      if (!Number.isFinite(requestId)) {
        return jsonError(400, "request_id requerido en body", "INVALID_BODY");
      }
      const result = await runInTenant(session, async () =>
        Applicant.editTravelRequest(requestId, body),
      );
      return jsonOk({ ...(result as Record<string, unknown> ?? {}), message: "Travel request updated" });
    }

    // ── PUT /cancel-travel-request/:request_id ────────────────────────────
    if (method === "PUT" && path.startsWith("cancel-travel-request/")) {
      const session = await requirePermissions(request, "travel_request:cancel");
      await assertCsrf(request);
      const requestId = Number(path.slice("cancel-travel-request/".length));
      // Validación de transición + cancel en el modelo legacy.
      await runInTenant(session, async () => {
        await applicantService.cancelTravelRequestValidation(requestId);
        return Applicant.cancelTravelRequest(requestId);
      });
      return jsonOk({ message: "Travel request cancelled" });
    }

    // ── POST /create-expense-validation ───────────────────────────────────
    if (method === "POST" && path === "create-expense-validation") {
      const session = await requirePermissions(request, "expense:submit");
      await assertCsrf(request);
      const body = await readJson(request);
      const receipts = Array.isArray(body?.receipts) ? body.receipts : [];
      const requestId = Number(body?.request_id);
      const result = await runInTenant(session, async () =>
        applicantService.createExpenseValidationBatch(receipts),
      );
      void requestId;
      return jsonOk(result);
    }

    // ── GET /get-completed-requests/:user_id ──────────────────────────────
    if (method === "GET" && path.startsWith("get-completed-requests/")) {
      const session = await requirePermissions(request, "travel_request:view_own");
      const userId = Number(path.slice("get-completed-requests/".length));
      const rows = await runInTenant(session, async () => Applicant.getCompletedRequests(userId));
      return jsonOk(rows ?? []);
    }

    // ── GET /get-user-request/:user_id (detalle SINGULAR) ─────────────────
    if (method === "GET" && path.startsWith("get-user-request/")) {
      const session = await requireAnyPermission(request, "travel_request:view_any", "travel_agent:attend");
      const requestId = Number(path.slice("get-user-request/".length));
      const detail = await runInTenant(session, async () => Applicant.getApplicantRequest(requestId));
      if (!detail) return jsonError(404, "Request not found", "REQUEST_NOT_FOUND");
      return jsonOk(detail);
    }

    // ── GET /get-user-requests/:user_id (lista) ───────────────────────────
    if (method === "GET" && path.startsWith("get-user-requests/")) {
      const session = await requireAnyPermission(request, "travel_request:view_any", "travel_agent:attend");
      const userId = Number(path.slice("get-user-requests/".length));
      const rows = await runInTenant(session, async () => Applicant.getApplicantRequests(userId));
      return jsonOk(rows ?? []);
    }

    // ── POST /create-draft-travel-request/:user_id ────────────────────────
    if (method === "POST" && path.startsWith("create-draft-travel-request/")) {
      const session = await requirePermissions(request, "travel_request:create");
      await assertCsrf(request);
      const userId = Number(path.slice("create-draft-travel-request/".length));
      const body = await readJson(request);
      const result = await runInTenant(session, async () =>
        Applicant.createDraftTravelRequest(userId, body),
      );
      return jsonOk({ ...(result as Record<string, unknown> ?? {}), message: "Draft saved" });
    }

    // ── PUT /confirm-draft-travel-request/:user_id/:request_id ────────────
    if (method === "PUT" && path.startsWith("confirm-draft-travel-request/")) {
      const session = await requirePermissions(request, "travel_request:submit");
      await assertCsrf(request);
      const rest = path.slice("confirm-draft-travel-request/".length).split("/");
      const userId = Number(rest[0]);
      const requestId = Number(rest[1]);
      if (!Number.isFinite(userId) || !Number.isFinite(requestId)) {
        return jsonError(400, "Invalid params", "INVALID_PARAMS");
      }
      const result = await runInTenant(session, async () =>
        Applicant.confirmDraftTravelRequest(userId, requestId),
      );
      return jsonOk({ ...(result as Record<string, unknown> ?? {}), message: "Draft confirmed" });
    }

    // ── PUT /send-expense-validation/:request_id ──────────────────────────
    if (method === "PUT" && path.startsWith("send-expense-validation/")) {
      const session = await requirePermissions(request, "expense:submit");
      await assertCsrf(request);
      const requestId = Number(path.slice("send-expense-validation/".length));
      await runInTenant(session, async () => applicantService.sendReceiptsForValidation(requestId));
      return jsonOk({ message: "Receipts sent for validation" });
    }

    // ── DELETE /delete-receipt/:receipt_id ────────────────────────────────
    if (method === "DELETE" && path.startsWith("delete-receipt/")) {
      const session = await requirePermissions(request, "expense:submit");
      await assertCsrf(request);
      const receiptId = Number(path.slice("delete-receipt/".length));
      await runInTenant(session, async () => Applicant.deleteReceipt(receiptId));
      return jsonOk({ message: "Receipt deleted" });
    }

    return jsonError(404, `Unknown applicant endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
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
