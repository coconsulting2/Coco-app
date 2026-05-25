/**
 * @module submitReceiptsForValidation
 * @description Use-case (proper, DI) que envía los comprobantes de una
 * solicitud a validación. Paridad 1:1 con el legacy
 * `applicantService.sendReceiptsForValidation`:
 *   - 404 si la solicitud no existe,
 *   - idempotente si ya está en status 7 (`alreadySubmitted: true`),
 *   - error de transición si el status no es 6,
 *   - update a status 7 en el happy path.
 * (El envío de correo del legacy queda fuera — no es paridad visible.)
 */
import {
  RequestNotFoundError,
  InvalidStatusTransitionError,
} from "~/contexts/travel-requests/domain/errors.js";
import type { ReceiptValidationSubmission } from "~/contexts/travel-requests/domain/ports/ReceiptValidationSubmission.js";

export type SubmitReceiptsForValidationInput = { requestId: number };
export type SubmitReceiptsForValidationDeps = {
  submission: ReceiptValidationSubmission;
};
export type SubmitReceiptsForValidationResult = {
  requestId: number;
  updatedStatus: 7;
  alreadySubmitted: boolean;
  message: string;
};

export async function submitReceiptsForValidation(
  input: SubmitReceiptsForValidationInput,
  deps: SubmitReceiptsForValidationDeps,
): Promise<SubmitReceiptsForValidationResult> {
  const raw = await deps.submission.getRequestStatus(input.requestId);
  const current = raw === null || raw === undefined ? null : Number(raw);

  if (current === null) {
    throw new RequestNotFoundError(input.requestId);
  }
  if (current === 7) {
    return {
      requestId: input.requestId,
      updatedStatus: 7,
      alreadySubmitted: true,
      message: "La solicitud ya está en validación de comprobantes.",
    };
  }
  if (current !== 6) {
    throw new InvalidStatusTransitionError(String(current), "enviar a validación");
  }

  await deps.submission.updateStatusToValidationStage(input.requestId);
  return {
    requestId: input.requestId,
    updatedStatus: 7,
    alreadySubmitted: false,
    message: "Comprobantes enviados a validación correctamente.",
  };
}
