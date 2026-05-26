/**
 * @module comprobar-solicitud.$id
 * @description Página del Solicitante: revisa los comprobantes de su solicitud
 * y los envía a validación (status 6 → 7). Loader carga la lista vía
 * `getReceiptsForRequestValidation`; action intent `send-for-validation` llama
 * al use-case `submitReceiptsForValidation` del slice travel-requests con
 * `assertCsrf` + `runInRls`. Tipado completo, sin supresiones.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  getReceiptsForRequestValidation,
  type RequestReceiptsForValidation,
} from "~/contexts/receipts-cfdi";
import {
  submitReceiptsForValidation,
  TravelRequestError,
} from "~/contexts/travel-requests";
import RequestValidationStatus from "~/shared/ui/RequestValidationStatus";

export function meta() {
  return [{ title: "Validar comprobantes — CocoConsulting" }];
}

function parseRequestId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    throw new Response("Request id inválido", { status: 400 });
  }
  return id;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "expense:submit");
  const requestId = parseRequestId(params.id);
  const receipts = await runInTenant(session, async () =>
    getReceiptsForRequestValidation({ requestId }),
  );
  return { requestId, receipts };
}

export type SubmitValidationActionResult =
  | { ok: true; alreadySubmitted: boolean; message: string }
  | { ok: false; error: string; code?: string };

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "expense:submit");
  await assertCsrf(request);
  const requestId = parseRequestId(params.id);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "send-for-validation") {
    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies SubmitValidationActionResult,
      { status: 400 },
    );
  }

  try {
    const result = await runInRls(session, async () =>
      submitReceiptsForValidation({ requestId }),
    );
    return Response.json(
      {
        ok: true,
        alreadySubmitted: result.alreadySubmitted,
        message: result.message,
      } satisfies SubmitValidationActionResult,
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof TravelRequestError) {
      return Response.json(
        { ok: false, error: err.message, code: err.code } satisfies SubmitValidationActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo enviar a validación.";
    return Response.json(
      { ok: false, error: msg } satisfies SubmitValidationActionResult,
      { status: 500 },
    );
  }
}

export default function PageRoute() {
  const { requestId, receipts } = useLoaderData() as {
    requestId: number;
    receipts: RequestReceiptsForValidation | null;
  };

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Solicitud
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Validar comprobantes</h1>
      </header>
      <RequestValidationStatus requestId={requestId} receipts={receipts} />
    </section>
  );
}
