/**
 * @module TravelRequestEditor
 * @description Puerto cohesivo para actualizar una solicitud editable. El
 * adapter por defecto delega en `Applicant.editTravelRequest` (flujo
 * transaccional legacy: update + recrear rutas). Sin transición de status.
 */
import type { EditTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request.js";

export type EditedTravelRequest = { requestId: number };

export interface TravelRequestEditor {
  edit(input: EditTravelRequestInput): Promise<EditedTravelRequest>;
}
