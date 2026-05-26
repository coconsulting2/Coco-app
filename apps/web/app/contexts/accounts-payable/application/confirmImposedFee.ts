/**
 * @module confirmImposedFee
 * @description Use-case puro con DI. CxP confirma el monto aprobado para
 * la Request: valida que esté en status 4 (Cotización del Viaje), persiste
 * `imposedFee` y avanza la transición de status según si la Request requiere
 * paso por Agencia (hotel o vuelo).
 *
 * Use-case único y canónico para "atender / cotizar" una Request por CxP.
 * Paridad legacy `accountsPayableController.attendTravelRequest`:
 *   - guard: 404 si la Request no existe o no está en status 4
 *   - target: `(hotel || plane) ? 5 : 6`
 */
import type { CxpAttendRepository } from "~/contexts/accounts-payable/domain/ports/CxpAttendRepository.js";

export type ConfirmImposedFeeInput = {
  requestId: number;
  imposedFee: number;
};

export type ConfirmImposedFeeDeps = { attendRepo: CxpAttendRepository };

export type ConfirmImposedFeeResult = {
  newStatusId: 5 | 6;
  needsAgency: boolean;
};

export class CxpRequestNotFoundError extends Error {
  readonly code = "CXPREQUESTNOTFOUND";
  readonly status = 404;
  constructor(message?: string) {
    super(message ?? "Request not found");
    this.name = "CxpRequestNotFoundError";
  }
}

/** La Request existe pero no está en un estado atendible por CxP (≠ status 4). */
export class CxpRequestNotAttendableError extends Error {
  readonly code = "CXPREQUESTNOTATTENDABLE";
  readonly status = 404;
  constructor(message?: string) {
    super(message ?? "This request cannot be attended by accounts payable");
    this.name = "CxpRequestNotAttendableError";
  }
}

export async function confirmImposedFee(
  input: ConfirmImposedFeeInput,
  deps: ConfirmImposedFeeDeps,
): Promise<ConfirmImposedFeeResult> {
  if (!Number.isFinite(input.imposedFee) || input.imposedFee < 0) {
    throw new Error("imposedFee must be a non-negative finite number");
  }

  const state = await deps.attendRepo.getAttendState(input.requestId);
  if (!state) throw new CxpRequestNotFoundError();

  if (state.requestStatusId !== 4) {
    throw new CxpRequestNotAttendableError();
  }

  const needsAgency = state.needsPlane || state.needsHotel;
  const nextStatusId: 5 | 6 = needsAgency ? 5 : 6;

  await deps.attendRepo.assignImposedFee(input.requestId, input.imposedFee, nextStatusId);
  return { newStatusId: nextStatusId, needsAgency };
}
