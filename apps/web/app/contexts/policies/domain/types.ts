/**
 * @module domain/types
 * @description Tipos puros del slice policies — shapes de fila (rows) y
 * payloads de entrada compartidos por application/ e infrastructure/. No
 * dependen de Prisma; los adapters en infrastructure/ devuelven estas formas.
 */
import type {
  CapUnit,
  DestinationScope,
} from "~/contexts/refunds/application/refundRuleEngine.js";

export type { CapUnit, DestinationScope };

/** Valor numérico que Prisma puede devolver como Decimal (toNumber) o string. */
export type NumericLike = number | string | { toNumber(): number } | null;

/** Fila de tope de gasto de una política. */
export interface ExpenseCapRow {
  capId: number;
  policyId: number;
  receiptTypeId: number;
  capAmount: NumericLike;
  capUnit: CapUnit;
  currency: string;
}

/** Categoría asociada a una política (parcial). */
export interface PolicyCategoryRow {
  categoryId: number;
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
}

/** Fila de TravelPolicy con caps y (opcionalmente) categoría incluidos. */
export interface TravelPolicyRow {
  policyId: number;
  organizationId: bigint | number;
  name: string;
  categoryId: number | null;
  destinationScope: DestinationScope;
  costsCenter: string | null;
  dailyPerDiem: NumericLike;
  currency: string;
  validFrom: Date | string;
  validTo: Date | string | null;
  active: boolean;
  expenseCaps?: ExpenseCapRow[];
  category?: PolicyCategoryRow | null;
}

/** Filtros opcionales para listar políticas. */
export interface ListPoliciesFilters {
  activeOnly?: boolean;
  categoryId?: number | null;
  asOfDate?: Date | string;
}

/** Payload de cap recibido desde el cliente (capId aún no asignado). */
export interface ExpenseCapInput {
  receiptTypeId: number | string;
  capAmount: number | string;
  capUnit: CapUnit;
  currency?: string;
}

/** Payload de creación/actualización de política. */
export interface PolicyPayload {
  name?: string;
  categoryId?: number | null;
  destinationScope?: DestinationScope;
  costsCenter?: string | null;
  dailyPerDiem?: number | string | null;
  currency?: string;
  validFrom?: Date | string;
  validTo?: Date | string | null;
  active?: boolean;
  caps?: ExpenseCapInput[];
}

/** Datos persistibles de una política (post-normalización). */
export interface PolicyData {
  organizationId: bigint | number;
  name: string;
  categoryId: number | null;
  destinationScope: DestinationScope;
  costsCenter: string | null;
  dailyPerDiem: number | string | null;
  currency: string;
  validFrom: Date;
  validTo: Date | null;
  active: boolean;
}

/** Fila de categoría de empleado. */
export interface EmployeeCategoryRow {
  categoryId: number;
  organizationId: bigint | number;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
}

/** Payload de categoría. */
export interface CategoryPayload {
  code?: string;
  name?: string;
  description?: string | null;
  active?: boolean;
}

/** Fila de excepción de política. */
export interface PolicyExceptionRow {
  exceptionId: number;
  organizationId: bigint | number;
  requestId: number;
  receiptId: number | null;
  policyId: number | null;
  capId: number | null;
  amountClaimed: NumericLike;
  amountAllowed: NumericLike;
  excessAmount: NumericLike;
  justification: string;
  status: string;
  requestedById: number;
  decidedById?: number | null;
  decidedAt?: Date | null;
  decisionNote?: string | null;
  createdAt?: Date | string;
}

/** Snapshot de workflow congelado en Request.workflowPreSnapshot. */
export interface WorkflowPreSnapshot {
  n1UserId?: number | null;
  n2UserId?: number | null;
  [key: string]: unknown;
}

/** Política de viáticos (shape de presentación legacy: snake_case). */
export interface ViaticosPolicyRow {
  id: number | bigint;
  org_id: string;
  max_hotel: number;
  max_meal: number;
  currency: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Payload de upsert de política de viáticos. */
export interface ViaticosPolicyPayload {
  maxHotel: number;
  maxMeal: number;
  currency?: string;
  active?: boolean;
}

/** Error con `status` HTTP, usado a través de application/. */
export interface HttpError extends Error {
  status: number;
}

/** Crea un Error con propiedad `status`. */
export function httpError(message: string, status: number): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}
