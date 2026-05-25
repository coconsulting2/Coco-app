/**
 * @module admin/refund-time-limits
 * @description Página admin del plazo de comprobación de gastos (M2-006 RF-37).
 * El loader precarga la config actual de la organización vía use-case hex
 * `getRefundTimeLimit` (port + adapter Prisma, DI en el slice) dentro de
 * `runInTenant`, y emite un token CSRF. La `action` persiste vía
 * `setRefundTimeLimit` bajo `runInRls` con `assertCsrf`. El componente es
 * prop-driven (`RefundTimeLimitConfig`) y muta vía `useFetcher`. Sin
 * `apiRequest`/`fetch('/api/...')`.
 *
 * Paridad legacy: `refundController.{getTimeLimit,setTimeLimit}`.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
  runInRls,
} from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import {
  getRefundTimeLimit,
  setRefundTimeLimit,
  InvalidRefundTimeLimitError,
  type RefundTimeLimit,
} from "~/contexts/refunds";
import RefundTimeLimitConfig from "~/shared/ui/RefundTimeLimitConfig";

export function meta() {
  return [{ title: "Plazo de reembolso — CocoConsulting" }];
}

export type RefundTimeLimitsLoaderData = {
  config: RefundTimeLimit;
  csrfToken: string;
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "policy:manage");
  const config = await runInTenant(session, async () =>
    getRefundTimeLimit(session.organizationId),
  );
  const csrf = issueCsrfToken(request);

  const payload: RefundTimeLimitsLoaderData = { config, csrfToken: csrf.token };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

export type RefundTimeLimitsActionData =
  | { ok: true; config: RefundTimeLimit }
  | { ok: false; error: string };

function parseIntField(form: FormData, name: string): number {
  return Number.parseInt(String(form.get(name) ?? ""), 10);
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "policy:manage");
  await assertCsrf(request);

  const form = await request.formData();
  const input = {
    daysAfterTrip: parseIntField(form, "daysAfterTrip"),
    graceDays: parseIntField(form, "graceDays"),
    blockOnExpiry: form.get("blockOnExpiry") === "true" || form.get("blockOnExpiry") === "on",
  };

  if (Number.isNaN(input.daysAfterTrip) || Number.isNaN(input.graceDays)) {
    return Response.json(
      { ok: false, error: "Valores numéricos inválidos." } satisfies RefundTimeLimitsActionData,
      { status: 400 },
    );
  }

  try {
    const config = await runInRls(session, async () =>
      setRefundTimeLimit(session.organizationId, input, session.user.user_id),
    );
    return Response.json(
      { ok: true, config } satisfies RefundTimeLimitsActionData,
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    const message =
      err instanceof InvalidRefundTimeLimitError
        ? err.message
        : err instanceof Error
          ? err.message
          : "No se pudo guardar la configuración.";
    return Response.json(
      { ok: false, error: message } satisfies RefundTimeLimitsActionData,
      { status: 400 },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as RefundTimeLimitsLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Reembolsos</p>
        <h1 className="font-serif text-3xl md:text-4xl">Plazo de reembolso</h1>
      </header>
      <RefundTimeLimitConfig config={data.config} csrfToken={data.csrfToken} />
    </section>
  );
}
