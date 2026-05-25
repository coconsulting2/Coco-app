/**
 * @module WorkflowSimulation
 * @description Tipos puros de la simulación de flujo de aprobación (M2-008).
 * Es el contrato que el panel admin (SimuladorWorkflow) renderiza. Espejo del
 * legacy `workflowSimulator.ts` pero como dominio del slice.
 */

export type SimExpenseType =
  | "viaje_nacional"
  | "viaje_internacional"
  | "hospedaje"
  | "transporte"
  | "alimentos"
  | "otros";

export type SimDestinationKind = "nacional" | "internacional";

export type WorkflowSimulationInput = {
  monto: number;
  tipo_gasto: SimExpenseType;
  destino: SimDestinationKind;
};

export type SimStepStatus = "pending" | "auto_approved" | "escalated" | "skipped";

export type WorkflowSimulationStep = {
  level: number;
  role: string;
  role_label: string;
  limit: number | null;
  status: SimStepStatus;
  note?: string;
};

export type WorkflowSimulationResult = {
  input: WorkflowSimulationInput;
  steps: WorkflowSimulationStep[];
  total_levels: number;
  auto_approved: boolean;
  escalation_triggered: boolean;
  summary: string;
};
