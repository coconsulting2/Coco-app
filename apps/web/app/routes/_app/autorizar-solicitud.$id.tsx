/**
 * @module autorizar-solicitud.$id
 * @description Loader carga el detalle de la solicitud; action discrimina por
 * `intent` (approve | reject | reassign) y llama al use-case del slice
 * approvals. Usa `runInRls` (transaccional) para mutaciones críticas — evita
 * el riesgo de RLS pool reuse en SET de sesión.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";

import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  authorizeTravelRequest,
  rejectTravelRequest,
  reassignApproval,
  ApprovalsError,
} from "~/contexts/approvals";
import TravelRequestAuthorizeActions from "~/shared/ui/TravelRequestAuthorizeActions";
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";

export function meta() {
  return [{ title: "Autorizar solicitud — CocoConsulting" }];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:authorize");
  const result = await runInTenant(session, async () =>
    getRequestDetail(Number(params.id)),
  );
  return { request: result };
}

export type AuthorizeActionResult =
  | { ok: true; redirect?: string }
  | { ok: false; error: string; code?: string };

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "travel_request:authorize");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const requestId = Number(params.id);

  if (!Number.isFinite(requestId) || requestId < 1) {
    return Response.json(
      { ok: false, error: "Request id inválido" } satisfies AuthorizeActionResult,
      { status: 400 },
    );
  }

  try {
    if (intent === "approve") {
      await runInRls(session, async () =>
        authorizeTravelRequest({
          requestId,
          actorUserId: session.user.user_id,
        }),
      );
      throw redirect("/dashboard");
    }

    if (intent === "reject") {
      const comentario = String(formData.get("comentario") ?? "").trim();
      if (!comentario) {
        return Response.json(
          {
            ok: false,
            error: "El comentario es obligatorio para rechazar.",
          } satisfies AuthorizeActionResult,
          { status: 400 },
        );
      }
      await runInRls(session, async () =>
        rejectTravelRequest({
          requestId,
          actorUserId: session.user.user_id,
          comentario,
        }),
      );
      throw redirect("/dashboard");
    }

    if (intent === "reassign") {
      const targetUserId = Number(formData.get("targetUserId"));
      const motivo = String(formData.get("motivo") ?? "").trim();
      if (!Number.isFinite(targetUserId) || targetUserId < 1) {
        return Response.json(
          {
            ok: false,
            error: "Indica un ID de usuario destino válido.",
          } satisfies AuthorizeActionResult,
          { status: 400 },
        );
      }
      if (!motivo) {
        return Response.json(
          {
            ok: false,
            error: "El motivo es obligatorio.",
          } satisfies AuthorizeActionResult,
          { status: 400 },
        );
      }
      await runInRls(session, async () =>
        reassignApproval({
          requestId,
          actorUserId: session.user.user_id,
          targetUserId,
          motivo,
        }),
      );
      return Response.json(
        { ok: true } satisfies AuthorizeActionResult,
        { status: 200 },
      );
    }

    return Response.json(
      {
        ok: false,
        error: `Intent desconocido: ${intent}`,
      } satisfies AuthorizeActionResult,
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof ApprovalsError) {
      return Response.json(
        {
          ok: false,
          error: err.message,
          code: err.code,
        } satisfies AuthorizeActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo completar la acción.";
    return Response.json(
      { ok: false, error: msg } satisfies AuthorizeActionResult,
      { status: 500 },
    );
  }
}

export default function PageRoute({ params }: { params: { id?: string } }) {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Autorizar
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Autorizar solicitud</h1>
      </header>
      <TravelRequestAuthorizeActions
        request_id={Number(params.id)}
        request={data.request}
      />
    </section>
  );
}
