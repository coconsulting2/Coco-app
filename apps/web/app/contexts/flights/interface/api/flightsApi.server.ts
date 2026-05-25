/**
 * @module flightsApi.server
 * @description Dispatcher /api/flights/*. Réplica del controller legacy
 * `postFlightSearch`. Cada loader/action de RR v7 in-app debería preferir DI
 * directo al use-case `searchFlights`; este resource route se conserva para
 * compatibilidad con componentes legacy y el contrato OpenAPI.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requireSession,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { searchFlights } from "~/contexts/flights";
import type { FlightSearchParams } from "@coco/integrations/duffel";

type DispatchArgs = { request: Request; subpath: string };

/** Body legacy de POST /api/flights/search (claves en español). */
type FlightSearchBody = {
  origen?: unknown;
  destino?: unknown;
  fecha?: unknown;
  fecha_regreso?: unknown;
  pasajeros?: unknown;
};

function mapSearchBody(body: FlightSearchBody | null): FlightSearchParams {
  const fechaRegreso = body?.fecha_regreso;
  return {
    origin: String(body?.origen ?? ""),
    destination: String(body?.destino ?? ""),
    departureDate: String(body?.fecha ?? ""),
    returnDate: fechaRegreso ? String(fechaRegreso) : undefined,
    passengers: Number(body?.pasajeros) || 1,
  };
}

export async function dispatchFlightsApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    if (method === "POST" && path === "search") {
      const session = await requireSession(request);
      await assertCsrf(request);
      const body = (await readJson(request)) as FlightSearchBody | null;
      const result = await runInTenant(session, () =>
        searchFlights(mapSearchBody(body)),
      );
      return jsonOk(result);
    }
    return jsonError(
      404,
      `Unknown flights endpoint: ${method} ${path}`,
      "UNKNOWN_ENDPOINT",
    );
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
