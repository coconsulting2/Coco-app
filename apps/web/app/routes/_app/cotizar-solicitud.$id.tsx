/**
 * @module cotizar-solicitud.$id
 * @description Pantalla CxP para confirmar el monto aprobado (imposed_fee)
 * de una Request. Loader: detalle (monto solicitado + necesidades de
 * agencia). Action: `intent=confirmImposedFee` invoca el use-case del
 * slice accounts-payable y redirige a /cotizaciones.
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
  confirmImposedFee,
  CxpRequestNotFoundError,
  CxpRequestNotAttendableError,
} from "~/contexts/accounts-payable";
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";

export function meta() {
  return [{ title: "Cotizar solicitud — CocoConsulting" }];
}

type RequestDetailRow = {
  request_id: number;
  requested_fee: number | string | null;
  plane_needed: boolean | null;
  hotel_needed: boolean | null;
};

type LoaderData = {
  requestId: number;
  requestedFee: number;
  needsPlane: boolean;
  needsHotel: boolean;
};

export async function loader({ request, params }: LoaderFunctionArgs): Promise<LoaderData> {
  const session = await requirePermissions(request, "accounts_payable:attend");
  const requestId = Number(params.id);
  const detailRows = (await runInTenant(session, async () =>
    getRequestDetail(requestId),
  )) as RequestDetailRow[] | null;

  const rows = detailRows ?? [];
  const first = rows[0];
  const requestedFee = Number(first?.requested_fee ?? 0) || 0;
  const needsPlane = rows.some((r) => r.plane_needed === true);
  const needsHotel = rows.some((r) => r.hotel_needed === true);

  return { requestId, requestedFee, needsPlane, needsHotel };
}

export type CotizarActionResult =
  | { ok: true; newStatusId: 5 | 6; needsAgency: boolean }
  | { ok: false; error: string };

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounts_payable:attend");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const requestId = Number(params.id);

  if (intent !== "confirmImposedFee") {
    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies CotizarActionResult,
      { status: 400 },
    );
  }

  const imposedFee = Number(formData.get("imposedFee"));
  if (!Number.isFinite(imposedFee) || imposedFee < 0) {
    return Response.json(
      {
        ok: false,
        error: "Indica un monto aprobado válido (mayor o igual a 0).",
      } satisfies CotizarActionResult,
      { status: 400 },
    );
  }

  try {
    await runInRls(session, async () =>
      confirmImposedFee({ requestId, imposedFee }),
    );
    throw redirect("/cotizaciones");
  } catch (err) {
    if (err instanceof Response) throw err;
    if (
      err instanceof CxpRequestNotFoundError ||
      err instanceof CxpRequestNotAttendableError
    ) {
      return Response.json(
        { ok: false, error: err.message } satisfies CotizarActionResult,
        { status: err.status },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo registrar el monto.";
    return Response.json(
      { ok: false, error: msg } satisfies CotizarActionResult,
      { status: 500 },
    );
  }
}

import CxpQuoteRequest from "~/shared/ui/CxpQuoteRequest";

export default function PageRoute() {
  const data = useLoaderData() as LoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Cotización
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Cotizar solicitud</h1>
      </header>
      <CxpQuoteRequest
        requestId={data.requestId}
        requestedFee={data.requestedFee}
        needsPlane={data.needsPlane}
        needsHotel={data.needsHotel}
      />
    </section>
  );
}
