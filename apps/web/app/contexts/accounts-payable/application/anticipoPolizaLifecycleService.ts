/**
 * @module anticipoPolizaLifecycleService
 * @description Persiste snapshots de la póliza AV en hitos del flujo:
 * aprobación de la solicitud (monto requested_fee) y cierre por comprobación
 * de gastos (monto imposed_fee).
 *
 * Refactor Fase 6: prisma + Prisma extraídos a anticipoPolizaQueries.
 */
import { buildAnticipoPolizaForAdvance } from "~/contexts/accounts-payable/application/accountingExportService.js";
import {
  findRequestWithAccountingContext,
  createAnticipoPolizaSnapshot,
  findRequestedFee,
  findImposedFee,
} from "~/contexts/accounts-payable/infrastructure/anticipoPolizaQueries.js";
import type { AccountingPoliza } from "~/contexts/accounts-payable/domain/entities/AccountingPoliza";

export const ON_TRAVEL_APPROVED = "ON_TRAVEL_APPROVED";
export const ON_EXPENSES_VERIFIED = "ON_EXPENSES_VERIFIED";

async function persistSnapshot(
  requestId: number,
  phase: string,
  advanceAmount: number,
): Promise<void> {
  const row = await findRequestWithAccountingContext(requestId);
  if (!row?.userId) return;

  const poliza = buildAnticipoPolizaForAdvance(
    {
      requestId: row.requestId,
      userId: row.userId,
      user: row.user,
      organization: row.organization,
    },
    advanceAmount,
  );
  if (!poliza) return;

  await createAnticipoPolizaSnapshot({
    organizationId: row.organizationId,
    requestId: row.requestId,
    phase,
    payload: poliza as unknown as AccountingPoliza,
  });
}

/**
 * Tras aprobación N1/N2: la solicitud pasa a cotización (status 4). Usa requested_fee.
 */
export async function onTravelRequestFullyApproved(requestId: number): Promise<void> {
  const row = await findRequestedFee(requestId);
  const amt = row?.requestedFee;
  if (amt === null || amt === undefined || Number(amt) <= 0) return;
  await persistSnapshot(requestId, ON_TRAVEL_APPROVED, Number(amt));
}

/**
 * Tras validar todos los recibos y marcar el viaje Finalizado. Usa imposed_fee.
 */
export async function onExpensesVerified(requestId: number): Promise<void> {
  const row = await findImposedFee(requestId);
  const amt = row?.imposedFee;
  if (amt === null || amt === undefined || Number(amt) <= 0) return;
  await persistSnapshot(requestId, ON_EXPENSES_VERIFIED, Number(amt));
}

const AnticipoPolizaLifecycleService = {
  onTravelRequestFullyApproved,
  onExpensesVerified,
  ON_TRAVEL_APPROVED,
  ON_EXPENSES_VERIFIED,
};

export default AnticipoPolizaLifecycleService;
