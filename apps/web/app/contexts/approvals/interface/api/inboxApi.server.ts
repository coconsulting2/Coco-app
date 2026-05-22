/**
 * @module inboxApi.server
 * @description Dispatcher `/api/solicitudes/inbox`. Hexagonal: usa el use-case
 * `getApprovalInbox` del slice approvals.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { getApprovalInbox } from "~/contexts/approvals";

type DispatchArgs = { request: Request; subpath: string };

export async function dispatchInboxApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    if (method !== "GET" || path !== "inbox") {
      return jsonError(404, `Unknown inbox endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
    }
    const session = await requirePermissions(request, "travel_request:authorize");
    // El statusId se infiere del rol: N1 → 2 (Primera Revisión), N2 → 3.
    const statusId: 2 | 3 = session.user.role === "N2" ? 3 : 2;
    const rows = await runInTenant(session, async () =>
      getApprovalInbox(session.user.user_id, statusId, {
        organizationId: session.organizationId,
        n: null,
      }),
    );
    return jsonOk(
      rows.map((r) => ({
        request_id: r.requestId,
        user_id: r.userId,
        destination_country: r.destinationCountry,
        beginning_date: r.beginningDate,
        ending_date: r.endingDate,
        request_status: r.requestStatus,
        requester_name: r.requesterName ?? null,
        department_name: r.departmentName ?? null,
      })),
    );
  } catch (err) {
    return jsonFromError(err);
  }
}
