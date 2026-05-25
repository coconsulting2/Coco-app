/**
 * @module legacyAdapters (approvals slice)
 * @description Adapters thin que envuelven servicios de OTROS slices aún
 * en `.js` legacy. Cumplen los ports del slice approvals para mantener la
 * arquitectura hexagonal de ESTE slice. Cuando los slices target sean
 * convertidos a hexagonal proper, estos adapters se reemplazan importando
 * directo del slice public API.
 */
import { statusAfterN1Approval, statusAfterN2Approval } from "~/contexts/workflow";
import * as legacyPolicyExceptionService from "~/contexts/policies/application/policyExceptionService";
import legacyAnticipoPolizaLifecycleService from "~/contexts/accounts-payable/application/anticipoPolizaLifecycleService";
import legacyEmployeeHierarchyService from "~/contexts/onboarding/application/employeeHierarchyService";

import type { WorkflowRulesPort } from "~/contexts/approvals/domain/ports/WorkflowRulesPort.js";
import type {
  PolicyExceptionPort,
  PolicyException,
} from "~/contexts/approvals/domain/ports/PolicyExceptionPort.js";
import type { AnticipoPolizaPort } from "~/contexts/approvals/domain/ports/AnticipoPolizaPort.js";
import type { EmployeeHierarchyPort } from "~/contexts/approvals/domain/ports/EmployeeHierarchyPort.js";

/**
 * Adapter del puerto WorkflowRulesPort que delega al slice workflow
 * (ya hexagonal). Reemplazó al legacy `LegacyWorkflowRulesAdapter` cuando el
 * slice workflow se convirtió en hexagonal proper.
 */
export class WorkflowRulesAdapter implements WorkflowRulesPort {
  statusAfterN1Approval(levels: number[]): number {
    return statusAfterN1Approval(levels);
  }
  statusAfterN2Approval(): number {
    return statusAfterN2Approval();
  }
}

export class LegacyPolicyExceptionAdapter implements PolicyExceptionPort {
  async listPendingForRequest(requestId: number): Promise<PolicyException[]> {
    const result = await legacyPolicyExceptionService.listPendingForRequest(requestId);
    // El slice policies expone `exceptionId`; el puerto de approvals usa `id`.
    return (result ?? []).map((row) => ({ ...row, id: row.exceptionId }));
  }
  async decideException(
    exceptionId: number,
    decision: "APPROVED" | "REJECTED",
    userId: number,
    note: string | null,
  ): Promise<unknown> {
    return legacyPolicyExceptionService.decideException(exceptionId, decision, userId, note);
  }
}

export class LegacyAnticipoPolizaAdapter implements AnticipoPolizaPort {
  async onTravelRequestFullyApproved(requestId: number): Promise<void> {
    await legacyAnticipoPolizaLifecycleService.onTravelRequestFullyApproved(requestId);
  }
}

export class LegacyEmployeeHierarchyAdapter implements EmployeeHierarchyPort {
  async getApprovalChain(userId: number, depth: number): Promise<number[]> {
    const chain = await legacyEmployeeHierarchyService.getApprovalChain(Number(userId), depth);
    return (chain ?? []).map((x: number) => Number(x));
  }
}
