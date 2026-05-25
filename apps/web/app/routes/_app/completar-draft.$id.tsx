/**
 * @module completar-draft.$id
 * @description Continuación de un borrador. Misma normalización que
 * `editar-solicitud.$id`; el mode='draft' indica al componente que la próxima
 * mutación es "confirmar borrador". Action RR7 con intents:
 *   - `edit`: guarda cambios (use-case `editTravelRequest`).
 *   - `confirm`: guarda cambios + confirma borrador (`editTravelRequest` luego
 *     `confirmDraftTravelRequest`) — server-side, sin encadenar en cliente.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteLoaderData } from "react-router";

import { requirePermissions, runInRls, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import type { AppLayoutData } from "~/routes/_app/_layout";
import TravelRequestForm from "~/shared/ui/TravelRequestForm";
import {
  getRequestDetail,
  getCostCenterForUser,
} from "~/contexts/travel-requests/application/applicantQueryService.js";
import { normalizeRequestDetailForForm } from "~/contexts/travel-requests/application/normalizeRequestDetailForForm";
import {
  editTravelRequest,
  confirmDraftTravelRequest,
  TravelRequestError,
  toEditTravelRequestInput,
  type SubmittedTravelBody,
} from "~/contexts/travel-requests/index.js";

export function meta() {
  return [{ title: "Completar borrador — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:create");
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    throw new Response("Request id inválido", { status: 400 });
  }
  const raw = await runInTenant(session, async () => getRequestDetail(requestId));
  const data = normalizeRequestDetailForForm(raw);
  if (!data) {
    throw new Response("Borrador no encontrado", { status: 404 });
  }
  const rawCostCenter = await runInTenant(session, async () =>
    getCostCenterForUser(session.user.user_id),
  );
  const costCenter = rawCostCenter
    ? {
        department_name: rawCostCenter.department_name,
        costs_center: rawCostCenter.costs_center ?? "",
      }
    : null;
  return { requestId, data, costCenter };
}

export type CompletarDraftActionResult =
  | { ok: true; requestId: number; redirectTo: string }
  | { ok: false; error: string; code?: string };

export async function action({ request, params }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "travel_request:create");
  await assertCsrf(request);
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    return Response.json(
      { ok: false, error: "Request id inválido" } satisfies CompletarDraftActionResult,
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "edit");
  let body: SubmittedTravelBody;
  try {
    body = JSON.parse(String(formData.get("body") ?? "")) as SubmittedTravelBody;
  } catch {
    return Response.json(
      { ok: false, error: "Payload JSON inválido en field 'body'." } satisfies CompletarDraftActionResult,
      { status: 400 },
    );
  }

  const userId = Number(session.user.user_id);

  try {
    if (intent === "confirm") {
      const result = await runInRls(session, async () => {
        await editTravelRequest(toEditTravelRequestInput(body, requestId));
        return confirmDraftTravelRequest(userId, requestId);
      });
      return Response.json(
        { ok: true, requestId: result.requestId, redirectTo: "/solicitudes-draft" } satisfies CompletarDraftActionResult,
        { status: 200 },
      );
    }

    // intent === "edit" (Guardar Cambios)
    const result = await runInRls(session, async () =>
      editTravelRequest(toEditTravelRequestInput(body, requestId)),
    );
    return Response.json(
      { ok: true, requestId: result.requestId, redirectTo: "/solicitudes-draft" } satisfies CompletarDraftActionResult,
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof TravelRequestError) {
      return Response.json(
        { ok: false, error: err.message, code: err.code } satisfies CompletarDraftActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo completar el borrador.";
    return Response.json(
      { ok: false, error: msg } satisfies CompletarDraftActionResult,
      { status: 500 },
    );
  }
}

export default function PageRoute() {
  const { requestId, data, costCenter } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const layout = useRouteLoaderData("routes/_app/_layout") as AppLayoutData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Borradores / Continuar</p>
        <h1 className="font-serif text-3xl md:text-4xl">Completar borrador #{requestId}</h1>
      </header>
      <TravelRequestForm
        mode="draft"
        role={layout.user.role}
        costCenter={costCenter}
        data={data as never}
      />
    </section>
  );
}
