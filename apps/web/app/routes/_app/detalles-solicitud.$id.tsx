/**
 * @module detalles-solicitud.$id
 * @description Detalle completo de una solicitud — paridad con legacy
 * `detalles-solicitud/[id].astro`:
 *
 *   - Header con status pill + back link según rol
 *   - Datos del usuario + tarifas + fechas
 *   - Itinerario (todas las rutas)
 *   - Notas
 *   - (CxP en status 7|8): sección inline de comprobantes con acciones
 *     de validación si status=7 (usa el use-case hex `validateReceiptDecision`
 *     ya wireado en `comprobar-gastos.$id`)
 *   - Timeline (SolicitudTimeline — recorrido loader-driven vía `getSolicitudJourney`)
 *   - CommentsThread — primera página loader-driven; POST vía action `add-comment`
 *
 * Loader carga el detalle + (si aplica) los receipts inline + el recorrido
 * (journey) + la primera página de comentarios. Action publica comentarios
 * y cancela. Tipado completo, sin supresiones.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteLoaderData } from "react-router";

import { requireAnyPermission, runInRls, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";
import {
  normalizeRequestDetailForDisplay,
  getSolicitudJourney,
  cancelTravelRequest,
  TravelRequestError,
  type RequestDetailDisplay,
} from "~/contexts/travel-requests/index.js";
import {
  getReceiptsForRequestValidation,
  type RequestReceiptsForValidation,
} from "~/contexts/receipts-cfdi/index.js";
import {
  readRequestComments,
  createRequestComment,
} from "~/contexts/workflow/index.js";

import ReceiptDetailCard from "~/shared/ui/ReceiptDetailCard";
import SolicitudTimeline from "~/shared/ui/SolicitudTimeline";
import CommentsThread from "~/shared/ui/comments/CommentsThread";
import type { RequestComments } from "~/shared/ui/comments/comments.utils";

import type { AppLayoutData } from "~/routes/_app/_layout";

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  return [
    { title: data?.detail ? `Solicitud #${data.detail.request_id} — CocoConsulting` : "Solicitud" },
  ];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
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

  // CxP en status 7|8: cargar receipts inline (mismo use-case que comprobar-gastos.$id).
  const isCxP = session.user.role === "Cuentas por pagar";
  const statusId = detail.request_status_id ?? 0;
  const showReceipts = isCxP && (statusId === 7 || statusId === 8);
  const receipts = showReceipts
    ? await runInTenant(session, async () => getReceiptsForRequestValidation({ requestId }))
    : null;

  // Recorrido (timeline) — loader-driven, reemplaza el fetch interno del componente.
  const initialJourney = await runInTenant(session, async () =>
    getSolicitudJourney({ requestId }),
  );

  // Comentarios — primera página loader-driven (reemplaza SSE + fetch interno).
  const userId = Number(session.user.user_id);
  const commentsResult = await runInTenant(session, async () =>
    readRequestComments(requestId, userId, COMMENTS_PAGE_SIZE),
  );
  const initialComments = toInitialComments(commentsResult, userId);

  return {
    detail,
    receipts,
    initialJourney,
    initialComments,
    canValidateReceipts: isCxP && statusId === 7,
    userId,
  };
}

const COMMENTS_PAGE_SIZE = 200;

/**
 * Mapea el resultado de `readRequestComments` (orden desc, `at: Date`) al shape
 * `RequestComments` que consume `CommentsThread` (orden asc, `at: string`).
 */
function toInitialComments(
  result: Awaited<ReturnType<typeof readRequestComments>>,
  _userId: number,
): RequestComments {
  if (!result.success) return { users: {}, messages: [] };
  return {
    users: result.data.users,
    ...(result.next ? { next: result.next } : {}),
    messages: result.data.messages
      .map((m) => ({
        pageIndex: m.pageIndex,
        at: m.at.toISOString(),
        user_key: m.user_key ?? "",
        content: m.content,
      }))
      .reverse(),
  };
}

export async function action({ request, params }: ActionFunctionArgs): Promise<Response> {
  const session = await requireAnyPermission(
    request,
    "travel_request:view_any",
    "travel_request:view_own",
    "travel_agent:attend",
  );
  await assertCsrf(request);

  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId < 1) {
    return Response.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "add-comment") {
    const content = String(formData.get("content") ?? "").trim();
    if (!content) {
      return Response.json({ ok: false, error: "El comentario no puede estar vacío." }, { status: 400 });
    }
    const result = await runInTenant(session, async () =>
      createRequestComment(Number(session.user.user_id), requestId, content),
    );
    if (!result.success) {
      return Response.json({ ok: false, error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true }, { status: 201 });
  }

  if (intent === "cancel") {
    try {
      await runInRls(session, async () => cancelTravelRequest({ requestId }));
      return Response.json({ ok: true }, { status: 200 });
    } catch (err) {
      if (err instanceof Response) throw err;
      if (err instanceof TravelRequestError) {
        return Response.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      const msg = err instanceof Error ? err.message : "No se pudo cancelar la solicitud.";
      return Response.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  return Response.json({ ok: false, error: `Intent desconocido: ${intent}` }, { status: 400 });
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function DetallesSolicitudRoute() {
  const { detail, receipts, initialJourney, initialComments, canValidateReceipts, userId } =
    useLoaderData() as LoaderData;
  const layout = useRouteLoaderData("routes/_app/_layout") as AppLayoutData;

  const isCxP = layout.user.role === "Cuentas por pagar";
  const backHref = isCxP ? "/todas-las-solicitudes" : "/dashboard";
  const statusLabel = detail.request_status?.toUpperCase() ?? "DESCONOCIDO";

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
            Coco / Solicitud
          </p>
          <h1 className="font-serif text-3xl md:text-4xl">Solicitud #{detail.request_id}</h1>
          <p className="text-[var(--color-ink-muted)]">
            <span className="status-pill text-xs uppercase tracking-widest text-[var(--color-primary-700)] bg-[var(--color-primary-100)] px-2 py-1 rounded mr-2">
              {statusLabel}
            </span>
          </p>
        </div>
        <Link
          to={backHref}
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

      {receipts && (
        <ReceiptsInline
          receipts={receipts}
          canValidate={canValidateReceipts}
          requestId={detail.request_id}
        />
      )}

      <section className="mt-8 pt-8 border-t-2 border-[var(--color-neutral-200)]">
        <SolicitudTimeline initialJourney={initialJourney} />
      </section>

      <section className="mt-8 pt-8 border-t-2 border-[var(--color-neutral-200)] max-h-2/12">
        <CommentsThread
          name={layout.user.username ?? ""}
          requestId={detail.request_id}
          currentUserId={userId}
          initialComments={initialComments}
        />
      </section>
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

function ReceiptsInline({
  receipts,
  canValidate,
  requestId,
}: {
  receipts: RequestReceiptsForValidation;
  canValidate: boolean;
  requestId: number;
}) {
  return (
    <section className="bg-white border border-[var(--color-neutral-200)] rounded-lg overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--color-neutral-200)]">
        <h2 className="font-serif text-xl">Comprobantes de la solicitud</h2>
        <p className="text-sm text-[var(--color-ink-muted)] mt-1">
          {receipts.items.length} comprobante(s) registrado(s).
          {canValidate ? (
            <>
              {" "}
              Para validar uno por uno usa la pantalla{" "}
              <Link
                to={`/comprobar-gastos/${requestId}`}
                className="text-primary-600 hover:underline"
              >
                comprobar-gastos
              </Link>
              .
            </>
          ) : null}
        </p>
      </header>
      {receipts.items.length === 0 ? (
        <div className="px-5 py-6 text-sm text-[var(--color-ink-muted)]">
          Esta solicitud aún no tiene comprobantes registrados.
        </div>
      ) : (
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
      )}
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
