/**
 * @module LocalWorkflowSimulator
 * @description Adapter default del puerto `WorkflowSimulatorPort`. Lógica pura
 * (sin DB) port-rewrite del legacy `workflowSimulator.ts`: dada una entrada de
 * prueba (monto + tipo de gasto + destino), produce la ruta de aprobación con
 * los niveles, escalaciones y auto-aprobación que aplicarían.
 */
import type { WorkflowSimulatorPort } from "~/contexts/workflow/domain/ports/WorkflowSimulatorPort.js";
import type {
  WorkflowSimulationInput,
  WorkflowSimulationResult,
  WorkflowSimulationStep,
} from "~/contexts/workflow/domain/entities/WorkflowSimulation.js";

const N1_LIMIT = 25000;
const N2_LIMIT = 100000;
const DIRECTOR_LIMIT = 500000;

const FORMATTER = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatMxn(amount: number): string {
  return FORMATTER.format(amount);
}

export class LocalWorkflowSimulator implements WorkflowSimulatorPort {
  simulate(input: WorkflowSimulationInput): WorkflowSimulationResult {
    const { monto, tipo_gasto, destino } = input;
    const steps: WorkflowSimulationStep[] = [];
    let escalation = false;
    let autoApproved = false;

    if (monto <= 0) {
      return {
        input,
        steps: [],
        total_levels: 0,
        auto_approved: false,
        escalation_triggered: false,
        summary:
          "Ingresa un monto mayor a cero para simular la ruta de aprobación.",
      };
    }

    if (
      monto < 5000 &&
      tipo_gasto !== "viaje_internacional" &&
      destino === "nacional"
    ) {
      autoApproved = true;
      steps.push({
        level: 1,
        role: "system",
        role_label: "Aprobación automática",
        limit: 5000,
        status: "auto_approved",
        note: "Monto bajo umbral: el sistema aprueba sin intervención humana.",
      });
      return {
        input,
        steps,
        total_levels: 1,
        auto_approved: true,
        escalation_triggered: false,
        summary: "Aprobación automática por monto bajo umbral de autorización.",
      };
    }

    steps.push({
      level: 1,
      role: "N1",
      role_label: "Autorizador N1",
      limit: N1_LIMIT,
      status: "pending",
      note:
        monto > N1_LIMIT
          ? `Excede el límite de N1 (${formatMxn(N1_LIMIT)}): escala al siguiente nivel.`
          : undefined,
    });

    if (monto > N1_LIMIT) {
      escalation = true;
      steps.push({
        level: 2,
        role: "N2",
        role_label: "Autorizador N2",
        limit: N2_LIMIT,
        status: "pending",
        note:
          monto > N2_LIMIT
            ? `Excede el límite de N2 (${formatMxn(N2_LIMIT)}): requiere dirección.`
            : undefined,
      });
    }

    if (monto > N2_LIMIT) {
      escalation = true;
      steps.push({
        level: steps.length + 1,
        role: "director",
        role_label: "Director de Finanzas",
        limit: DIRECTOR_LIMIT,
        status: "pending",
        note:
          monto > DIRECTOR_LIMIT
            ? `Excede el límite de dirección (${formatMxn(DIRECTOR_LIMIT)}): requiere comité.`
            : undefined,
      });
    }

    if (monto > DIRECTOR_LIMIT) {
      escalation = true;
      steps.push({
        level: steps.length + 1,
        role: "comite",
        role_label: "Comité Ejecutivo",
        limit: null,
        status: "escalated",
        note: "Última escalación: requiere aprobación colegiada.",
      });
    }

    if (destino === "internacional" || tipo_gasto === "viaje_internacional") {
      escalation = true;
      steps.push({
        level: steps.length + 1,
        role: "tesoreria",
        role_label: "Tesorería (divisa)",
        limit: null,
        status: "escalated",
        note: "Paso obligatorio por tratarse de un gasto en moneda extranjera.",
      });
    }

    const summary = autoApproved
      ? "Aprobación automática."
      : escalation
        ? `Ruta con escalación: ${steps.length} nivel${steps.length === 1 ? "" : "es"} de aprobación.`
        : `Ruta estándar: ${steps.length} nivel${steps.length === 1 ? "" : "es"} de aprobación.`;

    return {
      input,
      steps,
      total_levels: steps.length,
      auto_approved: autoApproved,
      escalation_triggered: escalation,
      summary,
    };
  }
}
