/**
 * Unit tests del use-case `simulateWorkflow` y su adapter default
 * `LocalWorkflowSimulator` (lógica pura, sin DB). Cubre auto-aprobación,
 * escalación por monto y paso obligatorio de divisa.
 */
import { describe, it, expect, vi } from "vitest";
import { simulateWorkflow } from "~/contexts/workflow/application/simulateWorkflow";
import { LocalWorkflowSimulator } from "~/contexts/workflow/infrastructure/LocalWorkflowSimulator";
import type { WorkflowSimulatorPort } from "~/contexts/workflow/domain/ports/WorkflowSimulatorPort";
import type {
  WorkflowSimulationInput,
  WorkflowSimulationResult,
} from "~/contexts/workflow/domain/entities/WorkflowSimulation";

describe("simulateWorkflow use-case", () => {
  it("delega en el port simulator con el input", async () => {
    const expected: WorkflowSimulationResult = {
      input: { monto: 1, tipo_gasto: "otros", destino: "nacional" },
      steps: [],
      total_levels: 0,
      auto_approved: false,
      escalation_triggered: false,
      summary: "stub",
    };
    const simulator: WorkflowSimulatorPort = { simulate: vi.fn(() => expected) };
    const out = await simulateWorkflow(expected.input, { simulator });
    expect(simulator.simulate).toHaveBeenCalledWith(expected.input);
    expect(out).toBe(expected);
  });
});

describe("LocalWorkflowSimulator", () => {
  const sim = new LocalWorkflowSimulator();
  const run = (input: WorkflowSimulationInput) => sim.simulate(input);

  it("rechaza monto cero", () => {
    const out = run({ monto: 0, tipo_gasto: "otros", destino: "nacional" });
    expect(out.total_levels).toBe(0);
    expect(out.steps).toHaveLength(0);
  });

  it("auto-aprueba montos bajos nacionales no internacionales", () => {
    const out = run({ monto: 3000, tipo_gasto: "alimentos", destino: "nacional" });
    expect(out.auto_approved).toBe(true);
    expect(out.steps[0]?.status).toBe("auto_approved");
  });

  it("escala N1 → N2 cuando excede el límite de N1", () => {
    const out = run({ monto: 60000, tipo_gasto: "otros", destino: "nacional" });
    expect(out.escalation_triggered).toBe(true);
    expect(out.steps.map((s) => s.role)).toContain("N2");
  });

  it("añade paso de tesorería para gasto internacional", () => {
    const out = run({ monto: 10000, tipo_gasto: "otros", destino: "internacional" });
    expect(out.steps.some((s) => s.role === "tesoreria")).toBe(true);
    expect(out.escalation_triggered).toBe(true);
  });
});
