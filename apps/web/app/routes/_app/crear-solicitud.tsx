/**
 * @module crear-solicitud
 * @description "Solicitar un viaje" — Loader resuelve permiso + centro de
 * costos del solicitante (DI). Action recibe el payload del form (JSON en
 * un single field) y llama al use-case hex `createTravelRequest` del slice
 * `travel-requests` (que internamente valida policy de viáticos + persiste).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteLoaderData } from "react-router";

import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { getCostCenterForUser } from "~/contexts/travel-requests/application/applicantQueryService.js";
import {
  createTravelRequest,
  createDraftTravelRequest,
  InvalidTravelRequestInputError,
  TravelRequestError,
  toCreateTravelRequestInput,
  toCreateDraftPartial,
  type SubmittedTravelBody,
} from "~/contexts/travel-requests/index.js";

import TravelRequestForm from "~/shared/ui/TravelRequestForm";
import type { AppLayoutData } from "~/routes/_app/_layout";

export function meta() {
  return [{ title: "Solicitar viaje — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:create");
  const rawCostCenter = await runInTenant(session, async () =>
    getCostCenterForUser(session.user.user_id),
  );
  const costCenter = rawCostCenter
    ? {
        department_name: rawCostCenter.department_name,
        costs_center: rawCostCenter.costs_center ?? "",
      }
    : null;
  return {
    userId: session.user.user_id,
    costCenter,
  };
}

export type CreateTravelRequestActionResult =
  | { ok: true; requestId: number; redirectTo: string }
  | { ok: false; error: string; code?: string };

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "travel_request:create");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");
  const bodyRaw = String(formData.get("body") ?? "");
  let body: SubmittedTravelBody;
  try {
    body = JSON.parse(bodyRaw) as SubmittedTravelBody;
  } catch {
    return Response.json(
      { ok: false, error: "Payload JSON inválido en field 'body'." } satisfies CreateTravelRequestActionResult,
      { status: 400 },
    );
  }

  const userId = Number(session.user.user_id);

  try {
    if (intent === "create-draft") {
      const result = await runInRls(session, async () =>
        createDraftTravelRequest(userId, toCreateDraftPartial(body)),
      );
      return Response.json(
        { ok: true, requestId: result.requestId, redirectTo: "/solicitudes-draft" } satisfies CreateTravelRequestActionResult,
        { status: 201 },
      );
    }

    // intent === "create" (default)
    const result = await runInRls(session, async () =>
      createTravelRequest(toCreateTravelRequestInput(body, userId)),
    );
    const redirectTo =
      session.user.role === "Solicitante" ? "/dashboard" : "/solicitudes-autorizador";
    return Response.json(
      { ok: true, requestId: result.requestId, redirectTo } satisfies CreateTravelRequestActionResult,
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof TravelRequestError || err instanceof InvalidTravelRequestInputError) {
      return Response.json(
        { ok: false, error: err.message, code: err.code } satisfies CreateTravelRequestActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo crear la solicitud.";
    return Response.json(
      { ok: false, error: msg } satisfies CreateTravelRequestActionResult,
      { status: 500 },
    );
  }
}

export default function CrearSolicitudRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const layout = useRouteLoaderData("routes/_app/_layout") as AppLayoutData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Solicitudes / Nueva
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Solicitar un viaje</h1>
        <p className="text-[var(--color-ink-muted)]">
          Complete el formulario para generar una nueva solicitud de viaje.
        </p>
      </header>

      <main className="card-editorial bg-white border border-[var(--color-neutral-200)] rounded-lg p-6 md:p-8">
        <TravelRequestForm
          mode="create"
          role={layout.user.role}
          costCenter={data.costCenter}
        />
      </main>
    </section>
  );
}
