/**
 * @module EmployeeHierarchyPort
 * @description Port para resolver la cadena de aprobación jerárquica
 * (`WORKFLOW_APPROVAL_MODE=hierarchy`). Implementado por el slice
 * `onboarding/` (employeeHierarchyService).
 */
export interface EmployeeHierarchyPort {
  /**
   * @param userId user_id del solicitante
   * @param depth máximo nivel de jerarquía a resolver
   * @returns array de userIds en orden ascendente (jefe directo, jefe del jefe, …)
   */
  getApprovalChain(userId: number, depth: number): Promise<number[]>;
}
