/**
 * @module TravelRequestCreator
 * @description Puerto cohesivo para persistir una solicitud nueva con sus
 * rutas. Más pequeño que `RequestRepository` completo para que el use-case
 * `createTravelRequest` no quede acoplado a métodos que no usa. El adapter
 * por defecto delega en el modelo legacy `Applicant.createTravelRequest`
 * que ya implementa todo el flujo transaccional (workflow snapshot,
 * rutas, refund context, alert).
 */
import type { CreateTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request.js";

export type CreatedTravelRequest = {
  requestId: number;
};

export interface TravelRequestCreator {
  create(input: CreateTravelRequestInput): Promise<CreatedTravelRequest>;
}
