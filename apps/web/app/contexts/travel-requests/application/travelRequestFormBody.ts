/**
 * @module travelRequestFormBody
 * @description Mappers puros del body snake_case que envía `TravelRequestForm`
 * (transport DTO) a los inputs camelCase del dominio. Compartido por las rutas
 * crear-solicitud / editar-solicitud / completar-draft para evitar duplicar la
 * traducción.
 */
import type {
  CreateTravelRequestInput,
  EditTravelRequestInput,
  RouteLeg,
} from "~/contexts/travel-requests/domain/entities/Request.js";

export type SubmittedRoute = {
  origin_country_name?: string;
  origin_city_name?: string;
  destination_country_name?: string;
  destination_city_name?: string;
  beginning_date?: string;
  beginning_time?: string;
  ending_date?: string;
  ending_time?: string;
  plane_needed?: boolean;
  hotel_needed?: boolean;
};

export type SubmittedTravelBody = SubmittedRoute & {
  notes?: string;
  requested_fee?: number | string;
  imposed_fee?: number | string;
  additionalRoutes?: SubmittedRoute[];
};

export function toFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function legFromSubmitted(r: SubmittedRoute): Omit<RouteLeg, "routerIndex"> {
  return {
    originCountryName: r.origin_country_name ?? "",
    originCityName: r.origin_city_name ?? "",
    destinationCountryName: r.destination_country_name ?? "",
    destinationCityName: r.destination_city_name ?? "",
    beginningDate: r.beginning_date ?? "",
    beginningTime: r.beginning_time ?? null,
    endingDate: r.ending_date ?? "",
    endingTime: r.ending_time ?? null,
    planeNeeded: Boolean(r.plane_needed),
    hotelNeeded: Boolean(r.hotel_needed),
  };
}

export function toCreateTravelRequestInput(
  body: SubmittedTravelBody,
  applicantUserId: number,
): CreateTravelRequestInput {
  return {
    applicantUserId,
    notes: body.notes ?? "",
    requestedFee: toFiniteNumber(body.requested_fee),
    imposedFee: toFiniteNumber(body.imposed_fee),
    mainRoute: legFromSubmitted(body),
    additionalRoutes: (body.additionalRoutes ?? []).map(legFromSubmitted),
  };
}

export function toEditTravelRequestInput(
  body: SubmittedTravelBody,
  requestId: number,
): EditTravelRequestInput {
  return {
    requestId,
    notes: body.notes ?? "",
    requestedFee: toFiniteNumber(body.requested_fee),
    imposedFee: 0,
    mainRoute: legFromSubmitted(body),
    additionalRoutes: (body.additionalRoutes ?? []).map(legFromSubmitted),
  };
}

export function toCreateDraftPartial(
  body: SubmittedTravelBody,
): Partial<CreateTravelRequestInput> {
  return {
    notes: body.notes ?? "",
    requestedFee: toFiniteNumber(body.requested_fee),
    imposedFee: 0,
    mainRoute: legFromSubmitted(body),
    additionalRoutes: (body.additionalRoutes ?? []).map(legFromSubmitted),
  };
}
