/**
 * @module manageRefundTimeLimit
 * @description Use-cases hexagonales (DI por parámetro) para leer y persistir
 * el plazo de comprobación de gastos por organización (M2-006 RF-37, RF-39).
 *
 * Paridad legacy: `refundController.getTimeLimit` / `setTimeLimit` +
 * `reimbursementTimeService.{getOrgTimeLimit,setOrgTimeLimit}`. La org se
 * resuelve en el route loader/action (sesión RR7), no aquí.
 *
 * Los use-cases reciben el `ReimbursementTimeRepository` por parámetro para que
 * los tests inyecten stubs; el `index.ts` los expone pre-wired con el adapter
 * Prisma por default.
 */
import type {
  ReimbursementTimeRepository,
  ReimbursementTimeLimitRow,
} from "~/contexts/refunds/domain/ports/ReimbursementTimeRepository.js";

export const DEFAULT_DAYS_AFTER_TRIP = 14;
export const DEFAULT_GRACE_DAYS = 0;
export const DEFAULT_BLOCK_ON_EXPIRY = true;

const MIN_DAYS_AFTER_TRIP = 1;
const MAX_DAYS_AFTER_TRIP = 365;
const MIN_GRACE_DAYS = 0;
const MAX_GRACE_DAYS = 30;

export type RefundTimeLimit = {
  daysAfterTrip: number;
  graceDays: number;
  blockOnExpiry: boolean;
  active: boolean;
};

export type SetRefundTimeLimitInput = {
  daysAfterTrip: number;
  graceDays: number;
  blockOnExpiry: boolean;
  active?: boolean;
};

export type ManageRefundTimeLimitDeps = {
  timeRepo: ReimbursementTimeRepository;
};

export class InvalidRefundTimeLimitError extends Error {
  readonly code = "INVALIDREFUNDTIMELIMIT";
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "InvalidRefundTimeLimitError";
  }
}

function defaultLimit(): RefundTimeLimit {
  return {
    daysAfterTrip: DEFAULT_DAYS_AFTER_TRIP,
    graceDays: DEFAULT_GRACE_DAYS,
    blockOnExpiry: DEFAULT_BLOCK_ON_EXPIRY,
    active: true,
  };
}

function toLimit(row: ReimbursementTimeLimitRow): RefundTimeLimit {
  return {
    daysAfterTrip: row.daysAfterTrip,
    graceDays: row.graceDays,
    blockOnExpiry: row.blockOnExpiry,
    active: row.active,
  };
}

/**
 * Lee la config de la organización. Devuelve los defaults si nunca se guardó
 * (paridad con `getOrgTimeLimit`, que el controller serializa tal cual).
 */
export async function getRefundTimeLimit(
  organizationId: bigint | number,
  deps: ManageRefundTimeLimitDeps,
): Promise<RefundTimeLimit> {
  const row = await deps.timeRepo.findByOrg(organizationId);
  if (!row) return defaultLimit();
  return toLimit(row);
}

function assertInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new InvalidRefundTimeLimitError(`${label} debe ser un número entero.`);
  }
  return value;
}

function assertRange(value: number, min: number, max: number, label: string): number {
  if (value < min || value > max) {
    throw new InvalidRefundTimeLimitError(
      `${label} debe estar entre ${min} y ${max}.`,
    );
  }
  return value;
}

/**
 * Persiste la config de la organización tras validar rangos (paridad con la
 * validación que el frontend legacy aplicaba: daysAfterTrip 1..365,
 * graceDays 0..30). `updatedById` es el usuario admin que ejecuta la acción.
 */
export async function setRefundTimeLimit(
  organizationId: bigint | number,
  input: SetRefundTimeLimitInput,
  updatedById: number | null,
  deps: ManageRefundTimeLimitDeps,
): Promise<RefundTimeLimit> {
  const daysAfterTrip = assertRange(
    assertInteger(input.daysAfterTrip, "Días después del fin de viaje"),
    MIN_DAYS_AFTER_TRIP,
    MAX_DAYS_AFTER_TRIP,
    "Días después del fin de viaje",
  );
  const graceDays = assertRange(
    assertInteger(input.graceDays, "Días de gracia"),
    MIN_GRACE_DAYS,
    MAX_GRACE_DAYS,
    "Días de gracia",
  );
  if (typeof input.blockOnExpiry !== "boolean") {
    throw new InvalidRefundTimeLimitError(
      "El indicador de bloqueo automático es obligatorio.",
    );
  }

  const row = await deps.timeRepo.upsert(organizationId, {
    daysAfterTrip,
    graceDays,
    blockOnExpiry: input.blockOnExpiry,
    active: input.active ?? true,
    updatedById,
  });
  return toLimit(row);
}
