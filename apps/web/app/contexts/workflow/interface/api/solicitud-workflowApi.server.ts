/**
 * @module solicitud-workflowApi.server
 * @description Dispatcher `/api/solicitudes/<id>/{aprobar,rechazar,reasignar}`.
 * Hexagonal: invoca use-cases del slice approvals vía la API pública.
 *
 * Nota: el endpoint legacy `historial` calleaba un método que no existe en
 * el authorizerModel; queda removido hasta que se defina su use-case en el
 * slice workflow (no es responsabilidad de approvals).
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  authorizeTravelRequest,
  rejectTravelRequest,
  reassignApproval,
} from "~/contexts/approvals";

type DispatchArgs = { request: Request; subpath: string };

export async function dispatchSolicitudWorkflowApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    if (method !== "POST") {
      return jsonError(404, `Unknown endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
    }

    const aprobarMatch = path.match(/^(\d+)\/aprobar$/);
    const rechazarMatch = path.match(/^(\d+)\/rechazar$/);
    const reasignarMatch = path.match(/^(\d+)\/reasignar$/);

    const session = await requirePermissions(request, "travel_request:authorize");
    await assertCsrf(request);
    const body = (await readJson(request)) ?? {};

    if (aprobarMatch) {
      const requestId = Number(aprobarMatch[1]);
      const result = await runInTenant(session, async () =>
        authorizeTravelRequest({ requestId, actorUserId: session.user.user_id }),
      );
      return jsonOk({ new_status: result.newStatusLabel, outcome: result.outcome });
    }

    if (rechazarMatch) {
      const requestId = Number(rechazarMatch[1]);
      const comentario = typeof body.comentario === "string" ? body.comentario : "";
      const result = await runInTenant(session, async () =>
        rejectTravelRequest({
          requestId,
          actorUserId: session.user.user_id,
          comentario,
        }),
      );
      return jsonOk({
        message: "Request declined successfully",
        new_status: result.newStatusLabel,
      });
    }

    if (reasignarMatch) {
      const requestId = Number(reasignarMatch[1]);
      const targetUserId = Number(body.userId ?? body.user_id);
      const motivo = typeof body.motivo === "string" ? body.motivo : "";
      const result = await runInTenant(session, async () =>
        reassignApproval({
          requestId,
          actorUserId: session.user.user_id,
          targetUserId,
          motivo,
        }),
      );
      return jsonOk(result);
    }

    return jsonError(404, `Unknown solicitud-workflow endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
