/**
 * @module PrismaTravelRequestCreator
 * @description Adapter para el port `TravelRequestCreator`. Mappea el
 * shape camelCase del dominio (`CreateTravelRequestInput`) al shape
 * snake_case que el flujo transaccional legacy `Applicant.createTravelRequest`
 * espera (rutas anidadas en `additionalRoutes`, primer leg expandido en
 * el top, etc.).
 *
 * El flujo transaccional (`prisma.$transaction` con workflow snapshot,
 * routes, refund context, alert) vive en el modelo legacy — el adapter
 * no lo reimplementa, solo lo invoca con el shape correcto.
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";
import {
  legToSnake,
  type LegacyRoute,
} from "~/contexts/travel-requests/infrastructure/legacyRouteMapper.js";
import type { CreateTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request.js";
import type {
  CreatedTravelRequest,
  TravelRequestCreator,
} from "~/contexts/travel-requests/domain/ports/TravelRequestCreator.js";

type LegacyCreateBody = LegacyRoute & {
  notes: string;
  requested_fee: number;
  imposed_fee: number;
  additionalRoutes: LegacyRoute[];
};

type LegacyCreateResult = { requestId?: number; request_id?: number; message?: string } | null;

export class PrismaTravelRequestCreator implements TravelRequestCreator {
  async create(input: CreateTravelRequestInput): Promise<CreatedTravelRequest> {
    const mainLeg = legToSnake(input.mainRoute, 0);
    const additionalRoutes: LegacyRoute[] = (input.additionalRoutes ?? []).map((leg, idx) =>
      legToSnake(leg, idx + 1),
    );

    const body: LegacyCreateBody = {
      ...mainLeg,
      notes: input.notes ?? "",
      requested_fee: input.requestedFee ?? 0,
      imposed_fee: input.imposedFee ?? 0,
      additionalRoutes,
    };

    const raw = (await Applicant.createTravelRequest(
      input.applicantUserId,
      body,
    )) as LegacyCreateResult;

    const requestId = Number(raw?.requestId ?? raw?.request_id ?? 0);
    if (!Number.isFinite(requestId) || requestId < 1) {
      throw new Error("Applicant.createTravelRequest no devolvió un requestId válido.");
    }
    return { requestId };
  }
}
