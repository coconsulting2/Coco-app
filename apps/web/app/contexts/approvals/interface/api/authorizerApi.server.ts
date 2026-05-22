/**
 * @module authorizerApi.server
 * @description Dispatcher `/api/authorizer/*`. Para flujos in-app nuevos,
 * preferir actions/loaders RR7 directos. Hexagonal: invoca use-cases del
 * slice approvals vía la API pública.
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
} from "~/contexts/approvals";

type DispatchArgs = { request: Request; subpath: string };

export async function dispatchAuthorizerApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const session = await requirePermissions(request, "travel_request:authorize");
    const authorizeMatch = path.match(/^authorize-travel-request\/(\d+)$/);
    const rejectMatch = path.match(/^reject-travel-request\/(\d+)$/);

    if (method === "PUT" && authorizeMatch) {
      await assertCsrf(request);
      const requestId = Number(authorizeMatch[1]);
      const result = await runInTenant(session, async () =>
        authorizeTravelRequest({ requestId, actorUserId: session.user.user_id }),
      );
      return jsonOk({
        new_status: result.newStatusLabel,
        outcome: result.outcome,
      });
    }

    if (method === "PUT" && rejectMatch) {
      await assertCsrf(request);
      const body = (await readJson(request)) ?? {};
      const requestId = Number(rejectMatch[1]);
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

    return jsonError(
      404,
      `Unknown authorizer endpoint: ${method} ${path}`,
      "UNKNOWN_ENDPOINT",
    );
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
