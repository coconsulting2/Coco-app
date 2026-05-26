/**
 * @module autorizar-solicitud.$id
 * @description Detalle de la solicitud para el aprobador + acciones N1/N2.
 *
 * Loader: gatea con permisos de LECTURA (`view_any`/`view_own`/`travel_agent:attend`)
 * — mismo gate que `detalles-solicitud.$id` — para permitir VISTA en solo
 * lectura a roles sin autorización (paridad con legacy `RequestApproval.astro`,
 * que mostraba el detalle sin botones cuando `canAuthorize === false`). Carga el
 * detalle (destino/fechas/monto/tramos), los comprobantes (si existen) y el
 * recorrido (historial). Calcula `canAuthorize` desde el permission set ya
 * resuelto y lo pasa al componente: los botones solo se renderizan si es true.
 *
 * Action: discrimina por `intent` (approve | reject | reassign), exige
 * `travel_request:authorize` + CSRF, y llama al use-case del slice approvals
 * dentro de `runInRls` (transaccional) — evita RLS pool reuse en SET de sesión.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, redirect, useLoaderData } from "react-router";

import {
  requireAnyPermission,
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
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";
import {
  normalizeRequestDetailForDisplay,
  getSolicitudJourney,
  type RequestDetailDisplay,
} from "~/contexts/travel-requests/index.js";
import {
  getReceiptsForRequestValidation,
  type RequestReceiptsForValidation,
} from "~/contexts/receipts-cfdi/index.js";
import TravelRequestAuthorizeActions from "~/shared/ui/TravelRequestAuthorizeActions";
import ReceiptDetailCard from "~/shared/ui/ReceiptDetailCard";
import SolicitudTimeline from "~/shared/ui/SolicitudTimeline";

export function meta() {
  return [{ title: "Autorizar solicitud — CocoConsulting" }];
}

const AUTHORIZE_PERMISSION = "travel_request:authorize";

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Gate de LECTURA (igual a detalles-solicitud): permite vista solo-lectura a
  // roles sin permiso de autorización.
  const session = await requireAnyPermission(
    request,
    "travel_request:view_any",
    "travel_request:view_own",
    "travel_agent:attend",
  );
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    throw new Response("ID inválido", { status: 400 });
  }

  const raw = await runInTenant(session, async () => getRequestDetail(requestId));
  const detail = normalizeRequestDetailForDisplay(raw);
  if (!detail) {
    throw new Response("Solicitud no encontrada", { status: 404 });
  }

  const receipts = await runInTenant(session, async () =>
    getReceiptsForRequestValidation({ requestId }),
  );
  const journey = await runInTenant(session, async () =>
    getSolicitudJourney({ requestId }),
  );

  // El permission set ya fue resuelto por requireAnyPermission.
  const canAuthorize = session.user.permissionSet?.has(AUTHORIZE_PERMISSION) ?? false;

  return { detail, receipts, journey, canAuthorize };
}

export type AuthorizeActionResult =
  | { ok: true; redirect?: string }
  | { ok: false; error: string; code?: string };

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, AUTHORIZE_PERMISSION);
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

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function PageRoute({ params }: { params: { id?: string } }) {
  const { detail, receipts, journey, canAuthorize } = useLoaderData() as LoaderData;
  const requestId = Number(params.id);
  const statusLabel = detail.request_status?.toUpperCase() ?? "DESCONOCIDO";

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
            Coco / Autorizar
          </p>
          <h1 className="font-serif text-3xl md:text-4xl">
            Solicitud #{detail.request_id}
          </h1>
          <p className="text-[var(--color-ink-muted)]">
            <span className="status-pill text-xs uppercase tracking-widest text-[var(--color-primary-700)] bg-[var(--color-primary-100)] px-2 py-1 rounded mr-2">
              {statusLabel}
            </span>
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-block px-4 py-2 rounded-md border border-[var(--color-neutral-300)] hover:bg-[var(--color-surface-secondary)]"
        >
          ← Volver
        </Link>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <UserSection user={detail.user} />
        <FeeSection detail={detail} />
      </div>

      <RoutesSection routes={detail.routes} />

      {detail.notes && <NotesSection notes={detail.notes} />}

      <ReceiptsSection receipts={receipts} requestId={detail.request_id} />

      <section className="mt-8 pt-8 border-t-2 border-[var(--color-neutral-200)]">
        <SolicitudTimeline initialJourney={journey} />
      </section>

      {canAuthorize ? (
        <TravelRequestAuthorizeActions request_id={requestId} />
      ) : (
        <div
          role="note"
          className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-surface-secondary)] px-4 py-3 text-sm text-[var(--color-ink-secondary)] max-w-xl"
        >
          Esta vista es de <strong>solo lectura</strong> para tu rol. Solo quienes
          tienen permiso para autorizar solicitudes de viaje pueden usar Aceptar,
          Rechazar o Reasignar.
        </div>
      )}
    </section>
  );
}

function UserSection({ user }: { user: RequestDetailDisplay["user"] }) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-5 space-y-2">
      <h2 className="font-serif text-xl border-b border-[var(--color-neutral-200)] pb-2 mb-2">
        Datos del usuario
      </h2>
      <Field label="Nombre" value={user.user_name} />
      <Field label="Correo" value={user.user_email} />
      <Field label="Teléfono" value={user.user_phone_number} />
    </section>
  );
}

function FeeSection({ detail }: { detail: RequestDetailDisplay }) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-5 space-y-2">
      <h2 className="font-serif text-xl border-b border-[var(--color-neutral-200)] pb-2 mb-2">
        Tarifas y fechas
      </h2>
      <Field label="Cuota solicitada" value={`$${detail.requested_fee.toFixed(2)}`} />
      <Field
        label="Cuota impuesta"
        value={detail.imposed_fee > 0 ? `$${detail.imposed_fee.toFixed(2)}` : "SIN ASIGNAR"}
      />
      <Field label="Días" value={detail.request_days != null ? String(detail.request_days) : "—"} />
      <Field label="Creada" value={fmt(detail.creation_date)} />
    </section>
  );
}

function RoutesSection({ routes }: { routes: RequestDetailDisplay["routes"] }) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-5">
      <h2 className="font-serif text-xl border-b border-[var(--color-neutral-200)] pb-2 mb-4">
        Itinerario
      </h2>
      {routes.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Sin rutas registradas.</p>
      ) : (
        <ul className="space-y-3">
          {routes.map((r, idx) => (
            <li
              key={`${r.router_index}-${idx}`}
              className="border border-[var(--color-neutral-200)] rounded p-4 bg-[var(--color-surface-secondary)]"
            >
              <p className="font-medium">
                Tramo {r.router_index + 1}: {r.origin_city ?? "?"}, {r.origin_country ?? "?"}
                {" → "}
                {r.destination_city ?? "?"}, {r.destination_country ?? "?"}
              </p>
              <p className="text-sm text-[var(--color-ink-muted)] mt-1">
                {fmt(r.beginning_date)} {r.beginning_time ?? ""} — {fmt(r.ending_date)}{" "}
                {r.ending_time ?? ""}
                {r.plane_needed && <> · ✈ vuelo</>}
                {r.hotel_needed && <> · 🏨 hotel</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotesSection({ notes }: { notes: string }) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-5">
      <h2 className="font-serif text-xl border-b border-[var(--color-neutral-200)] pb-2 mb-2">
        Observaciones
      </h2>
      <p className="text-sm whitespace-pre-wrap">{notes}</p>
    </section>
  );
}

function ReceiptsSection({
  receipts,
  requestId,
}: {
  receipts: RequestReceiptsForValidation | null;
  requestId: number;
}) {
  if (!receipts || receipts.items.length === 0) {
    return (
      <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-5">
        <h2 className="font-serif text-xl border-b border-[var(--color-neutral-200)] pb-2 mb-2">
          Comprobantes
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Esta solicitud aún no tiene comprobantes registrados.
        </p>
      </section>
    );
  }
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--color-neutral-200)]">
        <h2 className="font-serif text-xl">Comprobantes de la solicitud #{requestId}</h2>
        <p className="text-sm text-[var(--color-ink-muted)] mt-1">
          {receipts.items.length} comprobante(s) registrado(s).
        </p>
      </header>
      <div>
        {receipts.items.map((item, index) => (
          <ReceiptDetailCard
            key={item.receiptId}
            index={index}
            receiptId={item.receiptId}
            receiptTypeName={item.receiptTypeName}
            amount={item.amount}
            validation={item.validation}
            cfdi={item.cfdi}
            pdf={item.pdfFileId && item.pdfFileName ? { fileId: item.pdfFileId, fileName: item.pdfFileName } : null}
            xml={item.xmlFileId && item.xmlFileName ? { fileId: item.xmlFileId, fileName: item.xmlFileName } : null}
            apiBaseUrl="/api"
            isLast={index === receipts.items.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="text-sm">
      <span className="font-medium text-[var(--color-ink-secondary)]">{label}:</span>{" "}
      {value ?? "—"}
    </p>
  );
}

function fmt(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toISOString().split("T")[0]!;
  } catch {
    return String(date);
  }
}
