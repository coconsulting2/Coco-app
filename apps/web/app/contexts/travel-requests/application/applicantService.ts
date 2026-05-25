/**
 * @module applicantService
 * @description Service layer para operaciones del applicant: formatting de
 * rutas, cancelación, validación de batches de receipts, lookup de
 * country/city.
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";
import { findByCfdiUuid } from "~/contexts/receipts-cfdi/application/cfdiQueryService.js";

export type RouteInput = {
  router_index?: number;
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

export type ReceiptInput = {
  receipt_type_id: number;
  request_id: number;
  amount: number;
  cfdi_uuid?: string;
};

export class TravelRequestServiceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, message: string, code = "TRAVELREQUESTSERVICE") {
    super(message);
    this.name = "TravelRequestServiceError";
    this.status = status;
    this.code = code;
  }
}

export const formatRoutes = (
  mainRoute: RouteInput,
  additionalRoutes: RouteInput[] = [],
): RouteInput[] => {
  return [
    {
      origin_country_name: mainRoute.origin_country_name,
      origin_city_name: mainRoute.origin_city_name,
      destination_country_name: mainRoute.destination_country_name,
      destination_city_name: mainRoute.destination_city_name,
      router_index: mainRoute.router_index,
      beginning_date: mainRoute.beginning_date,
      beginning_time: mainRoute.beginning_time,
      ending_date: mainRoute.ending_date,
      ending_time: mainRoute.ending_time,
      plane_needed: mainRoute.plane_needed,
      hotel_needed: mainRoute.hotel_needed,
    },
    ...additionalRoutes.map((route) => ({
      router_index: route.router_index,
      origin_country_name: route.origin_country_name || "notSelected",
      origin_city_name: route.origin_city_name || "notSelected",
      destination_country_name: route.destination_country_name || "notSelected",
      destination_city_name: route.destination_city_name || "notSelected",
      beginning_date: route.beginning_date || "0000-01-01",
      beginning_time: route.beginning_time || "00:00:00",
      ending_date: route.ending_date || "0000-01-01",
      ending_time: route.ending_time || "00:00:00",
      plane_needed: route.plane_needed || false,
      hotel_needed: route.hotel_needed || false,
    })),
  ];
};

export const getRequestDays = (routes: RouteInput[]): number => {
  if (!routes || routes.length === 0) return 0;
  const sortedRoutes = [...routes].sort(
    (a, b) => (a.router_index ?? 0) - (b.router_index ?? 0),
  );
  const firstRoute = sortedRoutes[0]!;
  const lastRoute = sortedRoutes[sortedRoutes.length - 1]!;
  const startDate = new Date(`${firstRoute.beginning_date}T${firstRoute.beginning_time}`);
  const endDate = new Date(`${lastRoute.ending_date}T${lastRoute.ending_time}`);
  const diffInMs = endDate.getTime() - startDate.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  return Math.ceil(diffInDays);
};

export const cancelTravelRequestValidation = async (
  request_id: number,
): Promise<{
  message: string;
  request_id: number;
  request_status_id: 9;
  active: false;
}> => {
  const status_id = (await Applicant.getRequestStatus(request_id)) as number | null;
  if (status_id === null) {
    throw new TravelRequestServiceError(404, "Travel request not found");
  }
  if (![1, 2, 3, 4, 5, 9].includes(status_id)) {
    throw new TravelRequestServiceError(
      400,
      "Request cannot be cancelled after reaching 'Atención Agencia de Viajes'",
    );
  } else if (status_id === 9) {
    throw new TravelRequestServiceError(400, "Request has already been cancelled.");
  }

  await Applicant.cancelTravelRequest(request_id);
  return {
    message: "Travel request cancelled successfully",
    request_id,
    request_status_id: 9,
    active: false,
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createExpenseValidationBatch = async (
  receipts: ReceiptInput[],
  options: { allow_missing_cfdi_uuid?: boolean } = {},
): Promise<number> => {
  const allowMissingCfdiUuid = Boolean(options.allow_missing_cfdi_uuid);

  if (!Array.isArray(receipts) || receipts.length === 0) {
    throw new TravelRequestServiceError(
      400,
      'The "receipts" field must be a non-empty array',
      "BAD_REQUEST",
    );
  }

  for (const r of receipts) {
    if (
      typeof r.receipt_type_id !== "number" ||
      typeof r.request_id !== "number" ||
      typeof r.amount !== "number"
    ) {
      throw new TravelRequestServiceError(
        400,
        'Each receipt must include "receipt_type_id", "request_id", and "amount" (all as numbers)',
        "BAD_REQUEST",
      );
    }
  }

  const { assertRequestAllowsReceiptUpload } = await import(
    "~/contexts/travel-requests/application/requestReceiptUploadPolicy.js"
  );
  const uniqueRequestIds = [...new Set(receipts.map((r) => Number(r.request_id)))];
  for (const rid of uniqueRequestIds) {
    await assertRequestAllowsReceiptUpload(rid);
  }

  const uuidsInBatch = new Set<string>();
  for (const r of receipts) {
    const rawUuid = typeof r.cfdi_uuid === "string" ? r.cfdi_uuid.trim() : "";
    if (!rawUuid) {
      if (!allowMissingCfdiUuid) {
        throw new TravelRequestServiceError(
          400,
          "cfdi_uuid es obligatorio: debe extraerse del XML antes de crear el comprobante.",
          "BAD_REQUEST",
        );
      }
      continue;
    }
    if (!UUID_RE.test(rawUuid)) {
      throw new TravelRequestServiceError(
        400,
        "cfdi_uuid no tiene formato de UUID (CFDI) válido.",
        "BAD_REQUEST",
      );
    }
    const normalized = rawUuid.toLowerCase();
    if (uuidsInBatch.has(normalized)) {
      throw new TravelRequestServiceError(
        400,
        "La misma petición incluye el mismo cfdi_uuid más de una vez.",
        "BAD_REQUEST",
      );
    }
    uuidsInBatch.add(normalized);
    const dupCfdi = await findByCfdiUuid(normalized);
    if (dupCfdi) {
      throw new TravelRequestServiceError(
        409,
        "Este CFDI (UUID) ya está registrado en el sistema. No se creó un nuevo comprobante.",
        "DUPLICATE_CFDI_UUID",
      );
    }
    const dupReceipt = await Applicant.findReceiptByCfdiUuid(normalized);
    if (dupReceipt) {
      throw new TravelRequestServiceError(
        409,
        "Este UUID ya está asociado a otro comprobante. No se creó un duplicado.",
        "DUPLICATE_CFDI_UUID",
      );
    }
  }

  return Applicant.createExpenseBatch(receipts);
};

export const getCountryId = async (
  tx: { country: { upsert(args: unknown): Promise<{ countryId: number }> } },
  countryName: string | undefined | null,
): Promise<number | null> => {
  if (!countryName) return null;
  const country = await tx.country.upsert({
    where: { countryName },
    create: { countryName },
    update: {},
  });
  return country.countryId;
};

export const getCityId = async (
  tx: { city: { upsert(args: unknown): Promise<{ cityId: number }> } },
  cityName: string | undefined | null,
): Promise<number | null> => {
  if (!cityName) return null;
  const city = await tx.city.upsert({
    where: { cityName },
    create: { cityName },
    update: {},
  });
  return city.cityId;
};

export const sendReceiptsForValidation = async (
  requestId: number,
): Promise<{
  request_id: number;
  updated_status: 7;
  message: string;
  already_submitted?: boolean;
}> => {
  const rawStatus = await Applicant.getRequestStatus(requestId);
  const currentStatus =
    rawStatus === null || rawStatus === undefined ? null : Number(rawStatus);

  if (currentStatus === null) {
    throw new TravelRequestServiceError(404, `No request found with id ${requestId}`);
  }
  if (currentStatus === 7) {
    return {
      request_id: Number(requestId),
      updated_status: 7,
      message: "La solicitud ya está en validación de comprobantes.",
      already_submitted: true,
    };
  }
  if (currentStatus !== 6) {
    throw new TravelRequestServiceError(
      400,
      `La solicitud debe estar en estado 6 (Comprobación gastos del viaje) para enviarla a revisión. Estado actual: ${currentStatus}.`,
    );
  }
  await Applicant.updateRequestStatusToValidationStage(requestId);
  return {
    request_id: Number(requestId),
    updated_status: 7,
    message: "Request status updated to 'Validación de comprobantes'",
  };
};
