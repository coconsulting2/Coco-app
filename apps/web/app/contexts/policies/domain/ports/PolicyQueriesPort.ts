/**
 * @module PolicyQueriesPort
 * @description Puerto de acceso a datos para CRUD de TravelPolicy + caps.
 * Implementado por el adapter Prisma en `infrastructure/policyQueries`.
 */
import type {
  ExpenseCapInput,
  PolicyData,
  TravelPolicyRow,
} from "~/contexts/policies/domain/types";

/** Cliente Prisma transaccional, tipado de forma estructural mínima. */
export type PolicyTxClient = {
  travelPolicy: {
    findMany(args: unknown): Promise<TravelPolicyRow[]>;
  };
};

export type OverlapCheck = (
  tx: PolicyTxClient,
  payload: { organizationId: bigint | number; categoryId?: number | null; destinationScope: string; costsCenter?: string | null; validFrom: Date | string; validTo?: Date | string | null },
  excludePolicyId?: number | null,
) => Promise<boolean>;

export type SetCapsInTx = (
  tx: unknown,
  policyId: number,
  caps: ExpenseCapInput[],
) => Promise<void>;

export interface PolicyQueriesPort {
  listPoliciesWith(where: Record<string, unknown>): Promise<TravelPolicyRow[]>;
  findPolicyById(policyId: number): Promise<TravelPolicyRow | null>;
  updatePolicyRow(policyId: number, data: Record<string, unknown>): Promise<TravelPolicyRow>;
  createPolicyWithCapsTx(
    policyData: PolicyData,
    caps: ExpenseCapInput[],
    overlapCheck: OverlapCheck,
  ): Promise<TravelPolicyRow>;
  updatePolicyWithCapsTx(
    policyId: number,
    updateData: Record<string, unknown>,
    caps: ExpenseCapInput[] | undefined,
    setCapsTx: SetCapsInTx,
    overlapPayload: Record<string, unknown>,
    overlapCheck: OverlapCheck,
  ): Promise<TravelPolicyRow>;
  setExpenseCapsInTx: SetCapsInTx;
  replaceExpenseCapsTx(policyId: number, caps: ExpenseCapInput[]): Promise<TravelPolicyRow>;
  findPoliciesForRequestSnapshot(
    tx: unknown,
    requestId: number,
  ): Promise<{ orgId: bigint | null; policies: TravelPolicyRow[] }>;
  updateRequestSnapshot(tx: unknown, requestId: number, snapshot: unknown): Promise<unknown>;
}
