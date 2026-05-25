/**
 * @module ExpensePolicyPreviewQueries
 * @description Puerto de lectura para el preview de política de gasto (RF-44).
 * Expone exactamente las dos lecturas que el use-case `previewExpensePolicy`
 * necesita: el contexto de la solicitud (snapshot inmovilizado + org del
 * solicitante + rutas para inferir el scope) y las políticas activas de la
 * organización con sus topes. El adapter por defecto las resuelve vía Prisma.
 */
import type {
  ExpenseCapRow,
  TravelPolicyRow,
} from "~/contexts/refunds/application/refundRuleEngine.js";

/**
 * Cap congelado dentro de `Request.policyEvaluationSnapshot` (RF-46). No trae
 * `policyId` porque pertenece a la política del propio snapshot.
 */
export type FrozenSnapshotCap = {
  capId: number;
  receiptTypeId: number;
  capAmount: number;
  capUnit: ExpenseCapRow["capUnit"];
  currency: string;
};

/**
 * Snapshot de evaluación de política congelado al envío de la solicitud.
 */
export type PolicyEvaluationSnapshot = {
  policyId: number;
  name?: string;
  categoryId?: number | null;
  destinationScope?: string;
  costsCenter?: string | null;
  dailyPerDiem?: number | null;
  currency?: string;
  validFrom?: string;
  validTo?: string | null;
  caps?: FrozenSnapshotCap[];
};

/**
 * Tramo de ruta usado para inferir el scope (nacional vs internacional).
 */
export type PreviewRouteLeg = {
  route: {
    idOriginCountry: number | null;
    idDestinationCountry: number | null;
  } | null;
};

/**
 * Contexto mínimo de la solicitud para evaluar un comprobante hipotético.
 */
export type RequestPreviewContext = {
  requestId: number;
  policyEvaluationSnapshot: PolicyEvaluationSnapshot | null;
  organizationId: bigint | number | null;
  routeRequests: PreviewRouteLeg[];
};

/**
 * Política activa con sus topes (forma que consume el motor puro).
 */
export type ActivePolicyWithCaps = TravelPolicyRow & {
  expenseCaps: ExpenseCapRow[];
};

export interface ExpensePolicyPreviewQueries {
  /**
   * Carga el contexto de la solicitud necesario para el preview. Devuelve
   * `null` si la solicitud no existe.
   */
  findRequestContext(requestId: number): Promise<RequestPreviewContext | null>;

  /**
   * Lista las políticas activas de la organización con sus topes.
   */
  listActivePoliciesForOrg(
    organizationId: bigint | number,
  ): Promise<ActivePolicyWithCaps[]>;
}
