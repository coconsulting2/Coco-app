/**
 * @module travel-agentApi.server
 * @description Dispatcher /api/travel-agent/* — preservado para el contrato
 * Swagger M1. Para flujos in-app nuevos, prefiere actions/loaders directos
 * (DI) — ver `apps/web/app/routes/_app/atender-solicitud.$id.tsx`.
 *
 * Paridad legacy (`travelAgentController.js`):
 *   - PUT attend-request/:id           → markAttendedByAgency
 *   - PUT travel-request/:id/selected-flight → selectFlightOffer (slice flights)
 *   - PUT travel-request/:id/selected-hotel  → selectStayOffer  (slice hotels)
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { markAttendedByAgency } from "~/contexts/travel-agency";
import { selectFlightOffer } from "~/contexts/flights";
import { selectStayOffer } from "~/contexts/hotels";

type DispatchArgs = { request: Request; subpath: string };

type DispatchCtx = {
  session: Awaited<ReturnType<typeof requirePermissions>>;
  body: Record<string, unknown> | null;
};

const ROUTES: Array<{
  method: string;
  pattern: RegExp;
  handler: (m: RegExpMatchArray, ctx: DispatchCtx) => Promise<unknown>;
}> = [
  {
    method: "PUT",
    pattern: /^attend-request\/(\d+)$/,
    handler: async (m) => markAttendedByAgency({ requestId: Number(m[1]) }),
  },
  {
    method: "PUT",
    pattern: /^travel-request\/(\d+)\/selected-flight$/,
    handler: async (m, { body }) => {
      const offer = (body as { offer?: unknown })?.offer;
      if (!offer || typeof offer !== "object") {
        throw new Error("offer payload requerido");
      }
      await selectFlightOffer({
        requestId: Number(m[1]),
        offer: offer as Parameters<typeof selectFlightOffer>[0]["offer"],
      });
      return { ok: true };
    },
  },
  {
    method: "PUT",
    pattern: /^travel-request\/(\d+)\/selected-hotel$/,
    handler: async (m, { body }) => {
      const offer = (body as { offer?: unknown })?.offer;
      if (!offer || typeof offer !== "object") {
        throw new Error("offer payload requerido");
      }
      return selectStayOffer({
        requestId: Number(m[1]),
        offer: offer as Parameters<typeof selectStayOffer>[0]["offer"],
      });
    },
  },
];

export async function dispatchTravelAgentApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const session = await requirePermissions(request, "travel_agent:attend");
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = path.match(r.pattern);
      if (!m) continue;
      if (method !== "GET" && method !== "HEAD") {
        await assertCsrf(request);
      }
      const body =
        method !== "GET" && method !== "HEAD" ? await readJson(request) : null;
      const result = await runInTenant(session, async () =>
        r.handler(m, { session, body }),
      );
      return jsonOk(result ?? { ok: true });
    }
    return jsonError(
      404,
      `Unknown travel-agent endpoint: ${method} ${path}`,
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
