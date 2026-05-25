/**
 * @module simulateWorkflow
 * @description Use-case del simulador de flujo (M2-008). Valida la entrada y
 * delega en el port `WorkflowSimulatorPort` (lógica pura, sin DB). Deps por DI.
 */
import type { WorkflowSimulatorPort } from "~/contexts/workflow/domain/ports/WorkflowSimulatorPort.js";
import type {
  WorkflowSimulationInput,
  WorkflowSimulationResult,
} from "~/contexts/workflow/domain/entities/WorkflowSimulation.js";

export type SimulateWorkflowDeps = { simulator: WorkflowSimulatorPort };

export async function simulateWorkflow(
  input: WorkflowSimulationInput,
  deps: SimulateWorkflowDeps,
): Promise<WorkflowSimulationResult> {
  return deps.simulator.simulate(input);
}
