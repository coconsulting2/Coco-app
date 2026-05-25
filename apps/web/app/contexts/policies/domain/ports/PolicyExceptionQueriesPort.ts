/**
 * @module PolicyExceptionQueriesPort
 * @description Puerto de acceso a datos para CRUD de PolicyException +
 * side-effect transaccional de decisión. Implementado por el adapter Prisma
 * en `infrastructure/policyExceptionQueries`.
 */
import type {
  PolicyExceptionRow,
  WorkflowPreSnapshot,
} from "~/contexts/policies/domain/types";

export interface RequestForException {
  requestId: number;
  workflowPreSnapshot: WorkflowPreSnapshot | null;
  userId: number | null;
  organizationId: bigint | number;
}

export interface ExceptionWithRequest extends PolicyExceptionRow {
  request: {
    workflowPreSnapshot: WorkflowPreSnapshot | null;
    userId: number | null;
    organizationId: bigint | number;
  };
}

export interface PendingExceptionWithJoins extends PolicyExceptionRow {
  receipt?: {
    receiptId: number;
    amount: number | string;
    receiptType?: { receiptTypeName: string };
  } | null;
  request: {
    requestId: number;
    userId: number | null;
    workflowPreSnapshot: WorkflowPreSnapshot | null;
  };
}

export interface DecideExceptionArgs {
  exceptionId: number;
  exceptionUpdate: {
    status: string;
    decidedById: number;
    decidedAt: Date;
    decisionNote: string | null;
  };
  receiptId: number | null;
  refundFlag: boolean;
  requestId: number;
  organizationId: bigint | number;
  decidedById: number;
  accion: string;
  comentario: string;
}

export interface PolicyExceptionQueriesPort {
  findRequestForException(requestId: number): Promise<RequestForException | null>;
  createPolicyException(data: {
    organizationId: bigint | number;
    requestId: number;
    receiptId: number | null;
    policyId: number | null;
    capId: number | null;
    amountClaimed: number;
    amountAllowed: number | null;
    excessAmount: number;
    justification: string;
    status: string;
    requestedById: number;
  }): Promise<PolicyExceptionRow>;
  findExceptionWithRequest(exceptionId: number): Promise<ExceptionWithRequest | null>;
  decideExceptionTx(args: DecideExceptionArgs): Promise<PolicyExceptionRow>;
  findPendingExceptionsForRequest(requestId: number): Promise<PolicyExceptionRow[]>;
  findAllPendingExceptions(): Promise<PendingExceptionWithJoins[]>;
}
