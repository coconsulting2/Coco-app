/**
 * @module editTravelRequest
 * @description Use-case puro (DI) que actualiza una solicitud editable.
 * Paridad legacy (`applicantController.editTravelRequest`): valida shape mínimo
 * y persiste vía el port `TravelRequestEditor`. NOTA: el legacy NO aplica
 * `checkFeeVsViaticosPolicy` en edición (solo en create) — se respeta.
 */
import type { EditTravelRequestInput } from "~/contexts/travel-requests/domain/entities/Request.js";
import type {
  TravelRequestEditor,
  EditedTravelRequest,
} from "~/contexts/travel-requests/domain/ports/TravelRequestEditor.js";
import { InvalidTravelRequestInputError } from "~/contexts/travel-requests/domain/errors.js";

export type EditTravelRequestDeps = { editor: TravelRequestEditor };

export async function editTravelRequest(
  input: EditTravelRequestInput,
  deps: EditTravelRequestDeps,
): Promise<EditedTravelRequest> {
  if (!input.requestId || input.requestId < 1) {
    throw new InvalidTravelRequestInputError("requestId requerido para editar");
  }
  return deps.editor.edit(input);
}
