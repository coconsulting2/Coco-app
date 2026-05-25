/**
 * @module atender-solicitud.$id
 * @description Pantalla de Agencia para cotizar vuelos y hospedaje vía Duffel
 * y finalizar la atención de la solicitud. Loader: detalle de la Request
 * (necesidades y defaults). Action: discriminado por `intent`
 * (searchFlights | searchHotels | selectFlight | selectHotel | finalize).
 *
 * Las búsquedas usan `@coco/integrations/duffel` directo; las mutaciones
 * usan use-cases hexagonales (slices flights, hotels, travel-agency).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";

import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  searchFlightOffers,
  selectFlightOffer,
  type NormalizedFlightOffer,
} from "~/contexts/flights";
import {
  searchStays,
  selectStayOffer,
  type NormalizedStayOffer,
} from "~/contexts/hotels";
import { markAttendedByAgency, TravelAgencyError } from "~/contexts/travel-agency";
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";

export function meta() {
  return [{ title: "Atender solicitud — CocoConsulting" }];
}

type RequestDetailRow = {
  request_id: number;
  request_status_id: number;
  destination_country: string | null;
  destination_city: string | null;
  origin_country: string | null;
  origin_city: string | null;
  plane_needed: boolean | null;
  hotel_needed: boolean | null;
  beginning_date: string | Date | null;
  ending_date: string | Date | null;
};

type LoaderData = {
  requestId: number;
  needsPlane: boolean;
  needsHotel: boolean;
  flightDefaults: { fecha: string; pasajeros: number } | null;
  hotelDefaults: {
    ciudad: string;
    fecha_entrada: string;
    fecha_salida: string;
    huespedes: number;
  } | null;
};

function toIsoDate(d: string | Date | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function loader({ request, params }: LoaderFunctionArgs): Promise<LoaderData> {
  const session = await requirePermissions(request, "travel_agent:attend");
  const requestId = Number(params.id);
  const detailRows = (await runInTenant(session, async () =>
    getRequestDetail(requestId),
  )) as RequestDetailRow[] | null;

  const rows = detailRows ?? [];
  const needsPlane = rows.some((r) => r.plane_needed === true);
  const needsHotel = rows.some((r) => r.hotel_needed === true);
  const firstWithDate = rows.find((r) => r.beginning_date);

  const flightDefaults = needsPlane
    ? { fecha: toIsoDate(firstWithDate?.beginning_date ?? null), pasajeros: 1 }
    : null;

  const firstHotel = rows.find((r) => r.hotel_needed === true);
  const hotelDefaults = needsHotel
    ? {
        ciudad: firstHotel?.destination_city ?? firstHotel?.destination_country ?? "",
        fecha_entrada: toIsoDate(firstHotel?.beginning_date ?? null),
        fecha_salida: toIsoDate(firstHotel?.ending_date ?? null),
        huespedes: 1,
      }
    : null;

  return { requestId, needsPlane, needsHotel, flightDefaults, hotelDefaults };
}

export type AttendActionResult =
  | { ok: true; intent: "searchFlights"; offers: NormalizedFlightOffer[] }
  | { ok: true; intent: "searchHotels"; offers: NormalizedStayOffer[] }
  | { ok: true; intent: "selectFlight" }
  | { ok: true; intent: "selectHotel"; saved: NormalizedStayOffer }
  | { ok: false; intent: string; error: string };

function failure(intent: string, error: string, status = 400): Response {
  return Response.json(
    { ok: false, intent, error } satisfies AttendActionResult,
    { status },
  );
}

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "travel_agent:attend");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const requestId = Number(params.id);

  if (!Number.isFinite(requestId) || requestId < 1) {
    return failure(intent, "Request id inválido", 400);
  }

  try {
    if (intent === "searchFlights") {
      const origen = String(formData.get("origen") ?? "").toUpperCase().slice(0, 3);
      const destino = String(formData.get("destino") ?? "").toUpperCase().slice(0, 3);
      const fecha = String(formData.get("fecha") ?? "");
      const fechaRegreso = String(formData.get("fechaRegreso") ?? "").trim();
      const pasajeros = Math.max(1, Number(formData.get("pasajeros") ?? 1) || 1);
      const offers = await searchFlightOffers({
        origin: origen,
        destination: destino,
        departureDate: fecha,
        ...(fechaRegreso ? { returnDate: fechaRegreso } : {}),
        passengers: pasajeros,
      });
      return Response.json({
        ok: true,
        intent: "searchFlights",
        offers,
      } satisfies AttendActionResult);
    }

    if (intent === "searchHotels") {
      const ciudad = String(formData.get("ciudad") ?? "").trim();
      if (ciudad.length < 2) {
        return failure(intent, "Indica la ciudad (al menos 2 caracteres).");
      }
      const offers = await searchStays({
        ciudad,
        fechaEntrada: String(formData.get("fechaEntrada") ?? ""),
        fechaSalida: String(formData.get("fechaSalida") ?? ""),
        huespedes: Math.max(1, Number(formData.get("huespedes") ?? 1) || 1),
      });
      return Response.json({
        ok: true,
        intent: "searchHotels",
        offers,
      } satisfies AttendActionResult);
    }

    if (intent === "selectFlight") {
      const offerJson = String(formData.get("offer") ?? "");
      const offer = JSON.parse(offerJson) as NormalizedFlightOffer;
      await runInRls(session, async () =>
        selectFlightOffer({ requestId, offer }),
      );
      return Response.json({
        ok: true,
        intent: "selectFlight",
      } satisfies AttendActionResult);
    }

    if (intent === "selectHotel") {
      const offerJson = String(formData.get("offer") ?? "");
      const offer = JSON.parse(offerJson) as NormalizedStayOffer;
      const result = await runInRls(session, async () =>
        selectStayOffer({ requestId, offer }),
      );
      return Response.json({
        ok: true,
        intent: "selectHotel",
        saved: result.saved as NormalizedStayOffer,
      } satisfies AttendActionResult);
    }

    if (intent === "finalize") {
      await runInRls(session, async () =>
        markAttendedByAgency({ requestId }),
      );
      throw redirect("/dashboard");
    }

    return failure(intent, `Intent desconocido: ${intent}`, 400);
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof TravelAgencyError) {
      return failure(intent, err.message, err.status);
    }
    const msg = err instanceof Error ? err.message : "No se pudo completar la acción.";
    return failure(intent, msg, 500);
  }
}

import AttendRequest from "~/shared/ui/AttendRequest";
import AproveRequestModal from "~/shared/ui/AproveRequestModal";

export default function PageRoute() {
  const data = useLoaderData() as LoaderData;
  const needsAgencyQuotation = data.needsPlane || data.needsHotel;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Agencia
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Atender solicitud</h1>
      </header>
      {needsAgencyQuotation ? (
        <AttendRequest
          requestId={data.requestId}
          needsPlane={data.needsPlane}
          needsHotel={data.needsHotel}
          flightDefaults={data.flightDefaults}
          hotelDefaults={data.hotelDefaults}
        />
      ) : (
        <div className="flex justify-end gap-4">
          <AproveRequestModal
            request_id={data.requestId}
            title="Finalizar atención"
            message="¿Marcar esta solicitud como atendida por agencia? (sin vuelo requerido en la solicitud)"
            modal_type="success"
            variant="filled"
          >
            Finalizar atención
          </AproveRequestModal>
        </div>
      )}
    </section>
  );
}
