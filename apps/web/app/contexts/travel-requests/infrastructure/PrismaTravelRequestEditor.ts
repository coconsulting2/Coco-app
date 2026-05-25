/**
 * @module PrismaTravelRequestEditor
 * @description Adapter del port `TravelRequestEditor`. Mappea
 * `EditTravelRequestInput` (camelCase) al body snake_case que espera
 * `Applicant.editTravelRequest` (flujo transaccional legacy: update + recrear
 * rutas).
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";
import {
  legToSnake,
  type LegacyRoute,
} from "~/contexts/travel-requests/infrastructure/legacyRouteMapper.js";
import type { EditTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request.js";
import type {
  TravelRequestEditor,
  EditedTravelRequest,
} from "~/contexts/travel-requests/domain/ports/TravelRequestEditor.js";

const EMPTY_LEG = {
  originCountryName: "",
  originCityName: "",
  destinationCountryName: "",
  destinationCityName: "",
  beginningDate: "",
  beginningTime: null,
  endingDate: "",
  endingTime: null,
  planeNeeded: false,
  hotelNeeded: false,
};

type LegacyEditBody = LegacyRoute & {
  notes: string;
  requested_fee: number;
  imposed_fee: number;
  additionalRoutes: LegacyRoute[];
};

export class PrismaTravelRequestEditor implements TravelRequestEditor {
  async edit(input: EditTravelRequestInput): Promise<EditedTravelRequest> {
    const mainLeg = legToSnake(input.mainRoute ?? EMPTY_LEG, 0);
    const additionalRoutes: LegacyRoute[] = (input.additionalRoutes ?? []).map((leg, idx) =>
      legToSnake(leg, idx + 1),
    );

    const body: LegacyEditBody = {
      ...mainLeg,
      notes: input.notes ?? "",
      requested_fee: input.requestedFee ?? 0,
      imposed_fee: input.imposedFee ?? 0,
      additionalRoutes,
    };

    const raw = (await Applicant.editTravelRequest(input.requestId, body)) as {
      requestId?: number;
      request_id?: number;
    } | null;
    const requestId = Number(raw?.requestId ?? raw?.request_id ?? input.requestId);
    return { requestId };
  }
}
