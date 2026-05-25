/**
 * @module admin/indicadores-impuesto
 * @description Admin de indicadores de impuesto. El loader precarga indicadores
 * + mapeos (para el bloqueo de borrado en uso) vía el use-case hex
 * `loadAccountingCatalog`. La `action` expone create/update/delete que invocan
 * `createTaxIndicator` / `updateTaxIndicator` / `deleteTaxIndicator`
 * (DI → port → adapter), dentro de `requirePermissions` + `assertCsrf` +
 * `runInTenant`. `TaxIndicatorAdmin` es prop-driven + `useFetcher`.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import {
  loadAccountingCatalog,
  createTaxIndicator,
  updateTaxIndicator,
  deleteTaxIndicator,
  AccountsPayableError,
  type TaxIndicator,
  type ExpenseTypeMapping,
  type TaxIndicatorInput,
} from "~/contexts/accounts-payable";
import TaxIndicatorAdmin from "~/shared/ui/TaxIndicatorAdmin";

export function meta() {
  return [{ title: "Indicadores de impuesto — CocoConsulting" }];
}

export type IndicadoresImpuestoLoaderData = {
  taxIndicators: TaxIndicator[];
  mappings: ExpenseTypeMapping[];
  csrfToken: string;
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounting:export");
  const orgId = Number(session.organizationId);
  const snapshot = await runInTenant(session, async () => loadAccountingCatalog(orgId));
  const csrf = issueCsrfToken(request);

  const payload: IndicadoresImpuestoLoaderData = {
    taxIndicators: snapshot.taxIndicators,
    mappings: snapshot.mappings,
    csrfToken: csrf.token,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

export type TaxIndicatorActionResult =
  | { ok: true; intent: "create" | "update"; indicator: TaxIndicator }
  | { ok: true; intent: "delete"; id: number }
  | { ok: false; error: string };

function parseTaxIndicatorInput(form: FormData): TaxIndicatorInput {
  return {
    key: String(form.get("key") ?? ""),
    description: String(form.get("description") ?? ""),
    percentage: Number(form.get("percentage") ?? ""),
    type: String(form.get("type") ?? "") as TaxIndicatorInput["type"],
  };
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounting:export");
  await assertCsrf(request);
  const orgId = Number(session.organizationId);

  const form = await request.formData();
  const intent = String(form.get("_intent") ?? "");

  try {
    if (intent === "create") {
      const indicator = await runInTenant(session, async () =>
        createTaxIndicator(orgId, parseTaxIndicatorInput(form)),
      );
      return Response.json(
        { ok: true, intent: "create", indicator } satisfies TaxIndicatorActionResult,
        { status: 201 },
      );
    }
    if (intent === "update") {
      const id = Number(form.get("id"));
      const indicator = await runInTenant(session, async () =>
        updateTaxIndicator(orgId, id, parseTaxIndicatorInput(form)),
      );
      return Response.json(
        { ok: true, intent: "update", indicator } satisfies TaxIndicatorActionResult,
        { status: 200 },
      );
    }
    if (intent === "delete") {
      const id = Number(form.get("id"));
      await runInTenant(session, async () => deleteTaxIndicator(orgId, id));
      return Response.json(
        { ok: true, intent: "delete", id } satisfies TaxIndicatorActionResult,
        { status: 200 },
      );
    }
    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies TaxIndicatorActionResult,
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    const message =
      err instanceof AccountsPayableError
        ? err.message
        : err instanceof Error
          ? err.message
          : "No se pudo completar la acción.";
    const status = err instanceof AccountsPayableError ? err.status : 500;
    return Response.json(
      { ok: false, error: message } satisfies TaxIndicatorActionResult,
      { status },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as IndicadoresImpuestoLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Impuestos</p>
        <h1 className="font-serif text-3xl md:text-4xl">Indicadores de impuesto</h1>
      </header>
      <TaxIndicatorAdmin
        initialData={data.taxIndicators}
        initialMappings={data.mappings}
        csrfToken={data.csrfToken}
      />
    </section>
  );
}
