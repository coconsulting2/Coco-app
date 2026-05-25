/**
 * @module hotelsApi.server
 * @description Dispatcher /api/hotels/*. Réplica de los controllers legacy
 * `postHotelSearch` y `postHotelFetchRates`. Para flujos in-app nuevos,
 * prefiere DI directo a los use-cases `searchHotels` / `fetchHotelRates`.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import {
  requireSession,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { searchHotels, fetchHotelRates } from "~/contexts/hotels";
import type {
  StaySearchInputApp,
  NormalizedStayOffer,
} from "@coco/integrations/duffel";

type DispatchArgs = { request: Request; subpath: string };

/** Body legacy de POST /api/hotels/search (claves en español). */
type HotelSearchBody = {
  ciudad?: unknown;
  fecha_entrada?: unknown;
  fecha_salida?: unknown;
  huespedes?: unknown;
};

type HotelRatesBody = { base_offer?: unknown };

function mapSearchBody(body: HotelSearchBody | null): StaySearchInputApp {
  return {
    ciudad: String(body?.ciudad ?? ""),
    fechaEntrada: String(body?.fecha_entrada ?? ""),
    fechaSalida: String(body?.fecha_salida ?? ""),
    huespedes: Number(body?.huespedes) || 1,
  };
}

const RATES_PATTERN = /^search-results\/([\w-]+)\/rates$/;

export async function dispatchHotelsApi({
  request,
  subpath,
}: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    if (method === "POST" && path === "search") {
      const session = await requireSession(request);
      await assertCsrf(request);
      const body = (await readJson(request)) as HotelSearchBody | null;
      const result = await runInTenant(session, () =>
        searchHotels(mapSearchBody(body)),
      );
      return jsonOk(result);
    }

    const ratesMatch = path.match(RATES_PATTERN);
    if (method === "POST" && ratesMatch) {
      const session = await requireSession(request);
      await assertCsrf(request);
      const body = (await readJson(request)) as HotelRatesBody | null;
      const baseOffer = body?.base_offer;
      if (!baseOffer || typeof baseOffer !== "object") {
        return jsonError(400, "base_offer requerido", "VALIDATION");
      }
      const result = await runInTenant(session, () =>
        fetchHotelRates({
          searchResultId: ratesMatch[1] ?? "",
          baseOffer: baseOffer as NormalizedStayOffer,
        }),
      );
      return jsonOk(result);
    }

    return jsonError(
      404,
      `Unknown hotels endpoint: ${method} ${path}`,
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
