/**
 * @module createTravelRequest
 * @description Use-case puro (DI por parámetro) que crea una solicitud
 * de viaje con paridad 1:1 contra el controller legacy
 * `applicantController.createTravelRequest`:
 *
 *   1. Valida el shape mínimo (al menos `mainRoute` + `applicantUserId`).
 *   2. Verifica que el `requestedFee` no exceda los topes de la política
 *      de viáticos (port `ViaticasPolicyChecker`). En el legacy esto era
 *      `checkFeeVsViaticosPolicy` — el dispatcher actual lo había omitido;
 *      aquí lo restauramos.
 *   3. Persiste vía `TravelRequestCreator` (adapter Prisma encapsula el
 *      flujo transaccional completo: workflow snapshot, rutas,
 *      refund context, alert).
 */
import type { CreateTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request.js";
import type {
  TravelRequestCreator,
  CreatedTravelRequest,
} from "~/contexts/travel-requests/domain/ports/TravelRequestCreator.js";
import type { ViaticasPolicyChecker } from "~/contexts/travel-requests/domain/ports/ViaticasPolicyChecker.js";
import { InvalidTravelRequestInputError } from "~/contexts/travel-requests/domain/errors.js";

export type CreateTravelRequestDeps = {
  policy: ViaticasPolicyChecker;
  creator: TravelRequestCreator;
};

export type CreateTravelRequestResult = CreatedTravelRequest;

function assertMainRoute(input: CreateTravelRequestInput): void {
  if (!input.applicantUserId || input.applicantUserId < 1) {
    throw new InvalidTravelRequestInputError("applicantUserId requerido");
  }
  const r = input.mainRoute;
  if (!r) {
    throw new InvalidTravelRequestInputError("mainRoute requerido");
  }
  const required: Array<[string, unknown]> = [
    ["originCountryName", r.originCountryName],
    ["originCityName", r.originCityName],
    ["destinationCountryName", r.destinationCountryName],
    ["destinationCityName", r.destinationCityName],
    ["beginningDate", r.beginningDate],
    ["endingDate", r.endingDate],
  ];
  for (const [name, value] of required) {
    if (!value || (typeof value === "string" && value.trim() === "")) {
      throw new InvalidTravelRequestInputError(`mainRoute.${name} requerido`);
    }
  }
}

export async function createTravelRequest(
  input: CreateTravelRequestInput,
  deps: CreateTravelRequestDeps,
): Promise<CreateTravelRequestResult> {
  assertMainRoute(input);

  await deps.policy.assertFeeWithinPolicy({
    applicantUserId: input.applicantUserId,
    requestedFee: input.requestedFee ?? 0,
    hotelNeeded: Boolean(input.mainRoute.hotelNeeded),
  });

  return deps.creator.create(input);
}
