/**
 * @module workflow-simulator
 * @description Simulador de flujo de aprobación (M2-008). El action recibe los
 * parámetros de prueba y delega en el use-case hex `simulateWorkflow` (lógica
 * pura). SimuladorWorkflow es prop-driven + useFetcher (sin apiRequest).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { requirePermissions } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { simulateWorkflow } from "~/contexts/workflow";
import type {
  SimDestinationKind,
  SimExpenseType,
  WorkflowSimulationInput,
} from "~/contexts/workflow";
import SimuladorWorkflow from "~/shared/ui/SimuladorWorkflow";

export function meta() {
  return [{ title: "Simulador de workflow — CocoConsulting" }];
}

const EXPENSE_TYPES: readonly SimExpenseType[] = [
  "viaje_nacional",
  "viaje_internacional",
  "hospedaje",
  "transporte",
  "alimentos",
  "otros",
];
const DESTINATIONS: readonly SimDestinationKind[] = ["nacional", "internacional"];

function parseExpense(raw: string): SimExpenseType {
  return (EXPENSE_TYPES as readonly string[]).includes(raw)
    ? (raw as SimExpenseType)
    : "viaje_nacional";
}

function parseDestination(raw: string): SimDestinationKind {
  return (DESTINATIONS as readonly string[]).includes(raw)
    ? (raw as SimDestinationKind)
    : "nacional";
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePermissions(request, "workflow:manage");
  return { ok: true };
}

export type SimulatorActionResult =
  | {
      ok: true;
      result: Awaited<ReturnType<typeof simulateWorkflow>>;
    }
  | { ok: false; error: string };

export async function action({
  request,
}: ActionFunctionArgs): Promise<Response> {
  await requirePermissions(request, "workflow:manage");
  await assertCsrf(request);

  const formData = await request.formData();
  const monto = Number(formData.get("monto"));

  if (!Number.isFinite(monto) || monto <= 0) {
    return Response.json(
      {
        ok: false,
        error: "Ingresa un monto mayor a cero.",
      } satisfies SimulatorActionResult,
      { status: 400 },
    );
  }

  const input: WorkflowSimulationInput = {
    monto,
    tipo_gasto: parseExpense(String(formData.get("tipo_gasto") ?? "")),
    destino: parseDestination(String(formData.get("destino") ?? "")),
  };

  const result = await simulateWorkflow(input);
  return Response.json({ ok: true, result } satisfies SimulatorActionResult);
}

export default function PageRoute() {
  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Admin / Simulador
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Simulador de workflow</h1>
      </header>
      <SimuladorWorkflow />
    </section>
  );
}
