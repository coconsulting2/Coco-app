/**
 * @module editar-solicitud.$id
 * @description Edición de una solicitud existente. Loader DI a
 * `getRequestDetail` + normaliza el shape (array denormalizado → form input
 * anidado) vía `normalizeRequestDetailForForm`. Action RR7 (intent `edit`)
 * llama al use-case hex `editTravelRequest` con `assertCsrf` + `runInRls`.
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
  TravelRequestError,
  toEditTravelRequestInput,
  type SubmittedTravelBody,
} from "~/contexts/travel-requests/index.js";

export function meta() {
  return [{ title: "Editar solicitud — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:edit_own");
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    throw new Response("Request id inválido", { status: 400 });
  }
  const raw = await runInTenant(session, async () => getRequestDetail(requestId));
  const data = normalizeRequestDetailForForm(raw);
  if (!data) {
    throw new Response("Solicitud no encontrada", { status: 404 });
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

export type EditTravelRequestActionResult =
  | { ok: true; requestId: number; redirectTo: string }
  | { ok: false; error: string; code?: string };

export async function action({ request, params }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "travel_request:edit_own");
  await assertCsrf(request);
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    return Response.json(
      { ok: false, error: "Request id inválido" } satisfies EditTravelRequestActionResult,
      { status: 400 },
    );
  }

  const formData = await request.formData();
  let body: SubmittedTravelBody;
  try {
    body = JSON.parse(String(formData.get("body") ?? "")) as SubmittedTravelBody;
  } catch {
    return Response.json(
      { ok: false, error: "Payload JSON inválido en field 'body'." } satisfies EditTravelRequestActionResult,
      { status: 400 },
    );
  }

  try {
    const result = await runInRls(session, async () =>
      editTravelRequest(toEditTravelRequestInput(body, requestId)),
    );
    return Response.json(
      { ok: true, requestId: result.requestId, redirectTo: "/dashboard" } satisfies EditTravelRequestActionResult,
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof TravelRequestError) {
      return Response.json(
        { ok: false, error: err.message, code: err.code } satisfies EditTravelRequestActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo editar la solicitud.";
    return Response.json(
      { ok: false, error: msg } satisfies EditTravelRequestActionResult,
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
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Solicitudes / Editar</p>
        <h1 className="font-serif text-3xl md:text-4xl">Editar solicitud #{requestId}</h1>
      </header>
      <TravelRequestForm
        mode="edit"
        role={layout.user.role}
        costCenter={costCenter}
        data={data as never}
      />
    </section>
  );
}
