/**
 * @module WorkflowSimulatorPort
 * @description Puerto del simulador de flujo de aprobación (M2-008). Lógica
 * pura sin DB; el adapter default (`LocalWorkflowSimulator`) implementa la
 * política de negocio que vivía en el legacy `workflowSimulator.ts`.
 */
import type {
  WorkflowSimulationInput,
  WorkflowSimulationResult,
} from "~/contexts/workflow/domain/entities/WorkflowSimulation.js";

export interface WorkflowSimulatorPort {
  simulate(input: WorkflowSimulationInput): WorkflowSimulationResult;
}
