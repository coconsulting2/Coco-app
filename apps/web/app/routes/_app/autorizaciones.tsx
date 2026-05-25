/**
 * @module autorizaciones
 * @description Bandeja N1/N2 — solicitudes pendientes de autorizar + bandeja de
 * excepciones de política pendientes (paridad 1:1 con el legacy
 * `autorizaciones.astro`, que monta `ApprovalsInbox` + `PolicyExceptionsInbox`).
 *
 * Loader: `getApprovalInbox` del slice approvals (statusId=2 para N1, =3 para
 * N2) + `listPendingForApprover` del slice policies (mismo filtro que el legacy
 * `GET /refunds/exceptions/pending`: solo excepciones cuyo aprobador designado
 * en `workflowPreSnapshot` es el usuario actual). Emite CSRF para las
 * decisiones.
 *
 * Action: intent `policy-exception:decide` → `decideException` del slice
 * policies (approve/reject), paridad con `POST /refunds/exceptions/:id/decide`.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInRls,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import { getApprovalInbox } from "~/contexts/approvals";
import {
  decideException,
  listPendingForApprover,
  PoliciesError,
  type ExceptionDecision,
} from "~/contexts/policies";
import AuthRequestsList from "~/shared/ui/RequestsLists/AuthRequestsList";
import PolicyExceptionsInbox, {
  type PolicyExceptionRow,
} from "~/shared/ui/PolicyExceptionsInbox";
import type { UserRole } from "~/shared/types/roles";

export function meta() {
  return [{ title: "Autorizaciones — CocoConsulting" }];
}

/** Coacciona un NumericLike (number | string | Decimal | null) a number. */
function toNumber(value: number | string | { toNumber(): number } | null): number {
  if (value === null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

function toIsoString(value: Date | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "travel_request:authorize");
  const role = session.user.role as UserRole;
  const statusId: 2 | 3 = role === "N1" ? 2 : 3;

  const { inbox, pendingExceptions } = await runInTenant(session, async () => {
    const inboxRows = await getApprovalInbox(session.user.user_id, statusId, {
      organizationId: session.user.organization_id,
      n: null,
    });
    const exceptions = await listPendingForApprover(Number(session.user.user_id));
    return { inbox: inboxRows, pendingExceptions: exceptions };
  });

  const rows = inbox.map((r) => ({
    request_id: r.requestId,
    request_status: r.requestStatus ?? null,
    requester_name: r.requesterName ?? null,
    department_name: r.departmentName ?? null,
    destination_country: r.destinationCountry,
    beginning_date: r.beginningDate,
    ending_date: r.endingDate,
  }));

  const exceptions: PolicyExceptionRow[] = pendingExceptions.map((ex) => ({
    exceptionId: ex.exceptionId,
    requestId: ex.requestId,
    receiptId: ex.receiptId,
    amountClaimed: toNumber(ex.amountClaimed),
    excessAmount: toNumber(ex.excessAmount),
    justification: ex.justification,
    status: ex.status,
    createdAt: toIsoString(ex.createdAt),
    receipt: ex.receipt
      ? {
          receiptId: ex.receipt.receiptId,
          amount: toNumber(ex.receipt.amount),
          receiptType: ex.receipt.receiptType,
        }
      : null,
    request: { requestId: ex.request.requestId, userId: ex.request.userId },
  }));

  const csrf = issueCsrfToken(request);
  return new Response(JSON.stringify({ role, rows, exceptions, csrfToken: csrf.token }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

interface LoaderData {
  role: UserRole;
  rows: Array<{
    request_id: number;
    request_status: string | null;
    requester_name: string | null;
    department_name: string | null;
    destination_country: string;
    beginning_date: string;
    ending_date: string;
  }>;
  exceptions: PolicyExceptionRow[];
  csrfToken: string;
}

export type DecideExceptionActionResult = { ok: true } | { ok: false; error: string };

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "expense:authorize_exception");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "policy-exception:decide") {
    return Response.json(
      { ok: false, error: "Intent no soportado." } satisfies DecideExceptionActionResult,
      { status: 400 },
    );
  }

  const exceptionId = Number(formData.get("exceptionId"));
  const decisionRaw = String(formData.get("decision") ?? "");
  const decisionNote = String(formData.get("decisionNote") ?? "").trim() || null;

  if (!Number.isFinite(exceptionId) || exceptionId < 1) {
    return Response.json(
      { ok: false, error: "Exception id inválido." } satisfies DecideExceptionActionResult,
      { status: 400 },
    );
  }
  if (decisionRaw !== "APPROVED" && decisionRaw !== "REJECTED") {
    return Response.json(
      { ok: false, error: "Decisión inválida; usar APPROVED o REJECTED." } satisfies DecideExceptionActionResult,
      { status: 400 },
    );
  }
  const decision: ExceptionDecision = decisionRaw;

  try {
    await runInRls(session, async () =>
      decideException(exceptionId, decision, Number(session.user.user_id), decisionNote),
    );
    return Response.json({ ok: true } satisfies DecideExceptionActionResult, { status: 200 });
  } catch (error) {
    if (error instanceof PoliciesError) {
      return Response.json(
        { ok: false, error: error.message } satisfies DecideExceptionActionResult,
        { status: 400 },
      );
    }
    if (error instanceof Error) {
      const status = (error as Error & { status?: unknown }).status;
      if (typeof status === "number") {
        return Response.json(
          { ok: false, error: error.message } satisfies DecideExceptionActionResult,
          { status },
        );
      }
    }
    throw error;
  }
}

export default function PageRoute() {
  const { role, rows, exceptions, csrfToken } = useLoaderData() as LoaderData;
  const isApprover = role === "N1" || role === "N2";

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Pendientes</p>
        <h1 className="font-serif text-3xl md:text-4xl">Autorizaciones</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Solicitudes pendientes de autorizar como {role}.
        </p>
      </header>
      <AuthRequestsList data={rows} role={role} />
      {isApprover && (
        <PolicyExceptionsInbox exceptions={exceptions} csrfToken={csrfToken} />
      )}
    </section>
  );
}
