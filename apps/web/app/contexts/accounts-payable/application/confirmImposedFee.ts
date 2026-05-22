/**
 * @module confirmImposedFee
 * @description Use-case puro con DI. CxP confirma el monto aprobado para
 * la Request: persiste `imposedFee` y avanza la transición de status
 * según si la Request requiere paso por Agencia (hotel o vuelo).
 */
import type { CxpAttendRepository } from "~/contexts/accounts-payable/domain/ports/CxpAttendRepository.js";

export type ConfirmImposedFeeInput = {
  requestId: number;
  imposedFee: number;
};

export type ConfirmImposedFeeDeps = { attendRepo: CxpAttendRepository };

export type ConfirmImposedFeeResult = {
  newStatusId: 5 | 7;
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

export async function confirmImposedFee(
  input: ConfirmImposedFeeInput,
  deps: ConfirmImposedFeeDeps,
): Promise<ConfirmImposedFeeResult> {
  if (!Number.isFinite(input.imposedFee) || input.imposedFee < 0) {
    throw new Error("imposedFee must be a non-negative finite number");
  }

  const needs = await deps.attendRepo.getAgencyNeeds(input.requestId);
  if (!needs) throw new CxpRequestNotFoundError();

  const needsAgency = needs.needsPlane || needs.needsHotel;
  const nextStatusId: 5 | 7 = needsAgency ? 5 : 7;

  await deps.attendRepo.assignImposedFee(input.requestId, input.imposedFee, nextStatusId);
  return { newStatusId: nextStatusId, needsAgency };
}
