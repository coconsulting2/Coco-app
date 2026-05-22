/**
 * @module anticipoPolizaLifecycleService
 * @description Persiste snapshots de la póliza AV en hitos del flujo:
 * aprobación de la solicitud (monto requested_fee) y cierre por comprobación
 * de gastos (monto imposed_fee).
 *
 * Refactor Fase 6: prisma + Prisma extraídos a anticipoPolizaQueries.js.
 */
import { buildAnticipoPolizaForAdvance } from "./accountingExportService.js";
import {
  findRequestWithAccountingContext,
  createAnticipoPolizaSnapshot,
  findRequestedFee,
  findImposedFee,
} from "~/contexts/accounts-payable/infrastructure/anticipoPolizaQueries.js";

export const ON_TRAVEL_APPROVED = "ON_TRAVEL_APPROVED";
export const ON_EXPENSES_VERIFIED = "ON_EXPENSES_VERIFIED";

/**
 * @param {number} requestId
 * @param {string} phase ON_TRAVEL_APPROVED | ON_EXPENSES_VERIFIED
 * @param {number} advanceAmount
 */
async function persistSnapshot(requestId, phase, advanceAmount) {
  const row = await findRequestWithAccountingContext(requestId);
  if (!row?.userId) return;

  const poliza = buildAnticipoPolizaForAdvance(
    {
      requestId: row.requestId,
      userId: row.userId,
      organizationId: row.organizationId,
      organization: row.organization,
      user: row.user,
    },
    advanceAmount,
  );
  if (!poliza) return;

  await createAnticipoPolizaSnapshot({
    organizationId: row.organizationId,
    requestId: row.requestId,
    phase,
    payload: poliza,
  });
}

/**
 * Tras aprobación N1/N2: la solicitud pasa a cotización (status 4). Usa requested_fee.
 *
 * @param {number} requestId
 */
export async function onTravelRequestFullyApproved(requestId) {
  const row = await findRequestedFee(requestId);
  const amt = row?.requestedFee;
  if (amt === null || amt === undefined || Number(amt) <= 0) return;
  await persistSnapshot(requestId, ON_TRAVEL_APPROVED, Number(amt));
}

/**
 * Tras validar todos los recibos y marcar el viaje Finalizado. Usa imposed_fee.
 *
 * @param {number} requestId
 */
export async function onExpensesVerified(requestId) {
  const row = await findImposedFee(requestId);
  const amt = row?.imposedFee;
  if (amt === null || amt === undefined || Number(amt) <= 0) return;
  await persistSnapshot(requestId, ON_EXPENSES_VERIFIED, Number(amt));
}

export default {
  onTravelRequestFullyApproved,
  onExpensesVerified,
  ON_TRAVEL_APPROVED,
  ON_EXPENSES_VERIFIED,
};
