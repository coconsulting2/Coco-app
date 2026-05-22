/**
 * @module markAttended
 * @description Use-case puro con DI: confirma que una Request existe y la
 * avanza a status 6 (Comprobación gastos del viaje). Equivalente al legacy
 * `attendTravelRequest`.
 */
import type { AgencyAttendRepository } from "~/contexts/travel-agency/domain/ports/AgencyAttendRepository.js";
import { AttentionNotFoundError } from "~/contexts/travel-agency/domain/errors.js";

export type MarkAttendedInput = { requestId: number };
export type MarkAttendedDeps = { attendRepo: AgencyAttendRepository };
export type MarkAttendedResult = { newStatusId: 6 };

export async function markAttended(
  input: MarkAttendedInput,
  deps: MarkAttendedDeps,
): Promise<MarkAttendedResult> {
  const exists = await deps.attendRepo.requestExists(input.requestId);
  if (!exists) {
    throw new AttentionNotFoundError(`Request ${input.requestId} not found`);
  }
  await deps.attendRepo.markAttended(input.requestId);
  return { newStatusId: 6 };
}
