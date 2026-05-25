/**
 * Author: Emiliano Deyta Illescas (migrado a RR7 prop-driven + useFetcher)
 *
 * Description:
 * Unit tests for SimuladorWorkflow. El componente ya no consume `apiRequest`:
 * envía los parámetros al `action` de la ruta vía `useFetcher`, y el action
 * delega en el use-case hex `simulateWorkflow` (adapter `LocalWorkflowSimulator`).
 * Los tests montan el componente dentro de un `createRoutesStub` cuyo action
 * ejerce el simulador real, preservando las aserciones de negocio: render
 * inicial, validación de monto, escalación por monto, auto-aprobación, paso de
 * tesorería para destino internacional y reset del formulario.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import SimuladorWorkflow from "@components/SimuladorWorkflow";
import { LocalWorkflowSimulator } from "~/contexts/workflow/infrastructure/LocalWorkflowSimulator";
import type {
  SimDestinationKind,
  SimExpenseType,
} from "~/contexts/workflow/domain/entities/WorkflowSimulation";

const simulator = new LocalWorkflowSimulator();

function renderSimulator() {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: SimuladorWorkflow,
      async action({ request }) {
        const fd = await request.formData();
        const monto = Number(fd.get("monto"));
        if (!Number.isFinite(monto) || monto <= 0) {
          return Response.json(
            { ok: false, error: "Ingresa un monto mayor a cero." },
            { status: 400 },
          );
        }
        const result = simulator.simulate({
          monto,
          tipo_gasto: String(fd.get("tipo_gasto")) as SimExpenseType,
          destino: String(fd.get("destino")) as SimDestinationKind,
        });
        return Response.json({ ok: true, result });
      },
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("SimuladorWorkflow", () => {
  it("renders the parameters form with the default values", () => {
    renderSimulator();
    expect(
      screen.getByRole("heading", { name: /simulación de flujo de aprobación/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/monto/i)).toHaveValue(15000);
    expect(screen.getByLabelText(/tipo de gasto/i)).toHaveValue("viaje_nacional");
    expect(screen.getByLabelText(/destino/i)).toHaveValue("nacional");
    expect(screen.getByRole("button", { name: /simular flujo/i })).toBeInTheDocument();
  });

  it("shows a validation error and clears any previous result when monto is zero or negative", async () => {
    const user = userEvent.setup();
    renderSimulator();

    const monto = screen.getByLabelText(/monto/i);
    await user.clear(monto);
    await user.type(monto, "0");
    await user.click(screen.getByRole("button", { name: /simular flujo/i }));

    expect(
      await screen.findByText(/ingresa un monto mayor a cero/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ruta de aprobación/i)).not.toBeInTheDocument();
  });

  it("escalates through N1 → N2 → director for a large amount", async () => {
    const user = userEvent.setup();
    renderSimulator();

    const monto = screen.getByLabelText(/monto/i);
    await user.clear(monto);
    await user.type(monto, "150000");
    await user.click(screen.getByRole("button", { name: /simular flujo/i }));

    expect(await screen.findByText("Autorizador N1")).toBeInTheDocument();
    expect(screen.getByText("Autorizador N2")).toBeInTheDocument();
    expect(screen.getByText("Director de Finanzas")).toBeInTheDocument();
    expect(screen.getAllByText(/escalación/i).length).toBeGreaterThan(0);
  });

  it("auto-approves a small national non-international expense", async () => {
    const user = userEvent.setup();
    renderSimulator();

    const monto = screen.getByLabelText(/monto/i);
    await user.clear(monto);
    await user.type(monto, "1000");
    await user.click(screen.getByRole("button", { name: /simular flujo/i }));

    const matches = await screen.findAllByText(/aprobación automática/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText(/auto-aprobado/i)).toBeInTheDocument();
  });

  it("appends a treasury step when destination is international", async () => {
    const user = userEvent.setup();
    renderSimulator();

    await user.selectOptions(screen.getByLabelText(/destino/i), "internacional");
    await user.click(screen.getByRole("button", { name: /simular flujo/i }));

    expect(await screen.findByText(/tesorería/i)).toBeInTheDocument();
  });

  it("clears the result and resets the form when the limpiar button is clicked", async () => {
    const user = userEvent.setup();
    renderSimulator();

    const monto = screen.getByLabelText(/monto/i);
    await user.clear(monto);
    await user.type(monto, "150000");
    await user.click(screen.getByRole("button", { name: /simular flujo/i }));
    await waitFor(() => {
      expect(screen.getByText("Autorizador N1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /limpiar/i }));

    expect(screen.queryByText("Autorizador N1")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/monto/i)).toHaveValue(15000);
  });
});
