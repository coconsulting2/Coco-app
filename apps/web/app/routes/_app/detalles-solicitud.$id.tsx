// @ts-nocheck — legacy route/view props mismatch; M11 UI follow-up
/**
 * @module detalles-solicitud.$id
 * @description Detalle de una solicitud. Loader DI a `Applicant.getApplicantRequest(id)`.
 * Renderiza el componente legacy `RequestDetail` (Astro convertido — pendiente
 * de conversión a React puro en Fase 6).
 *
 * Por ahora, mostramos el detalle con un layout React mínimo. La vista completa
 * con todas las acciones (aprobar, rechazar, subir comprobante) requiere
 * migrar `RequestDetail.astro` a React, lo cual es trabajo de Fase 4.
 */
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteLoaderData } from "react-router";

import { requireAnyPermission, runInTenant } from "~/platform/session/requireUser.server";
import { getRequestDetail } from "~/contexts/travel-requests/application/applicantQueryService.js";

import type { AppLayoutData } from "./_layout";

export function meta({ data }: { data?: Awaited<ReturnType<typeof loader>> }) {
  return [
    { title: data?.request ? `Solicitud #${data.request.requestId} — CocoConsulting` : "Solicitud" },
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
  if (!Number.isFinite(requestId)) {
    throw new Response("ID inválido", { status: 400 });
  }
  const detail = await runInTenant(session, async () => getRequestDetail(requestId));
  if (!detail) {
    throw new Response("Solicitud no encontrada", { status: 404 });
  }
  // Normalize shape (modelo devuelve estructura del legacy con joins).
  return {
    request: {
      requestId: detail.requestId,
      status: detail.requestStatus?.status ?? "Desconocido",
      statusId: detail.requestStatus?.requestStatusId ?? null,
      notes: detail.notes,
      requestedFee: detail.requestedFee,
      imposedFee: detail.imposedFee,
      requestDays: detail.requestDays,
      creationDate: detail.creationDate,
      applicant: detail.user
        ? {
            userId: detail.user.userId,
            userName: detail.user.userName,
          }
        : null,
      routes: (detail.routeRequests ?? []).map((rr: any) => ({
        routerIndex: rr.route?.routerIndex ?? null,
        originCountry: rr.route?.originCountry?.countryName ?? null,
        originCity: rr.route?.originCity?.cityName ?? null,
        destinationCountry: rr.route?.destinationCountry?.countryName ?? null,
        destinationCity: rr.route?.destinationCity?.cityName ?? null,
        beginningDate: rr.route?.beginningDate ?? null,
        endingDate: rr.route?.endingDate ?? null,
        hotelNeeded: Boolean(rr.route?.hotelNeeded),
        planeNeeded: Boolean(rr.route?.planeNeeded),
      })),
    },
  };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function DetallesSolicitudRoute() {
  const { request: detail } = useLoaderData() as LoaderData;
  const layout = useRouteLoaderData("routes/_app/_layout") as AppLayoutData;

  const backHref = layout.user.role === "Cuentas por pagar" ? "/todas-las-solicitudes" : "/dashboard";

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Solicitud
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Solicitud #{detail.requestId}</h1>
        <p className="text-[var(--color-ink-muted)]">
          <span className="status-pill text-xs uppercase tracking-widest text-[var(--color-primary-700)] bg-[var(--color-primary-100)] px-2 py-1 rounded mr-2">
            {detail.status}
          </span>
          {detail.applicant && <>Solicitante: <strong>{detail.applicant.userName}</strong></>}
        </p>
      </header>

      <article className="grid gap-4 md:grid-cols-2">
        <Card label="Días de viaje" value={String(detail.requestDays)} />
        <Card label="Anticipo solicitado" value={detail.requestedFee != null ? `$${detail.requestedFee}` : "—"} />
        <Card label="Anticipo aprobado" value={detail.imposedFee != null ? `$${detail.imposedFee}` : "—"} />
        <Card label="Creada" value={fmt(detail.creationDate)} />
      </article>

      {detail.notes && (
        <article className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-5">
          <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)] mb-2">
            Notas
          </p>
          <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>
        </article>
      )}

      <article className="space-y-3">
        <h2 className="font-serif text-2xl">Itinerario</h2>
        <ul className="grid gap-3">
          {detail.routes.map((r, idx) => (
            <li
              key={`${r.routerIndex}-${idx}`}
              className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-4"
            >
              <p className="font-medium">
                Tramo {r.routerIndex ?? idx + 1}: {r.originCity}, {r.originCountry} → {r.destinationCity}, {r.destinationCountry}
              </p>
              <p className="text-sm text-[var(--color-ink-muted)]">
                {fmt(r.beginningDate)} — {fmt(r.endingDate)}
                {r.planeNeeded && <> · ✈ vuelo</>}
                {r.hotelNeeded && <> · 🏨 hotel</>}
              </p>
            </li>
          ))}
        </ul>
      </article>

      <div>
        <Link
          to={backHref}
          className="inline-block px-4 py-2 rounded-md border border-[var(--color-neutral-300)] hover:bg-[var(--color-surface-secondary)]"
        >
          ← Volver
        </Link>
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-4">
      <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] mb-1">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
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
