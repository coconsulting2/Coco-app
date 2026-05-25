/**
 * @module admin/mapeo-gastos
 * @description Admin del mapeo tipo-de-gasto → cuentas (cargo/abono) +
 * indicador. El loader precarga mapeos + cuentas + tipos de comprobante +
 * indicadores vía el use-case hex `loadAccountingCatalog`. La `action` expone
 * create/update/delete que invocan `createExpenseTypeMapping` /
 * `updateExpenseTypeMapping` / `deleteExpenseTypeMapping` (DI → port → adapter),
 * dentro de `requirePermissions` + `assertCsrf` + `runInTenant`.
 * `ExpenseTypeMappingAdmin` es prop-driven + `useFetcher`.
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
  createExpenseTypeMapping,
  updateExpenseTypeMapping,
  deleteExpenseTypeMapping,
  AccountsPayableError,
  type AccountingAccount,
  type ExpenseTypeMapping,
  type ReceiptTypeCatalogItem,
  type TaxIndicator,
  type ExpenseTypeMappingInput,
} from "~/contexts/accounts-payable";
import ExpenseTypeMappingAdmin from "~/shared/ui/ExpenseTypeMappingAdmin";

export function meta() {
  return [{ title: "Mapeo de gastos — CocoConsulting" }];
}

export type MapeoGastosLoaderData = {
  mappings: ExpenseTypeMapping[];
  accounts: AccountingAccount[];
  receiptTypes: ReceiptTypeCatalogItem[];
  taxIndicators: TaxIndicator[];
  csrfToken: string;
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounting:export");
  const orgId = Number(session.organizationId);
  const snapshot = await runInTenant(session, async () => loadAccountingCatalog(orgId));
  const csrf = issueCsrfToken(request);

  const payload: MapeoGastosLoaderData = {
    mappings: snapshot.mappings,
    accounts: snapshot.accounts,
    receiptTypes: snapshot.receiptTypes,
    taxIndicators: snapshot.taxIndicators,
    csrfToken: csrf.token,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

export type ExpenseTypeMappingActionResult =
  | { ok: true; intent: "create" | "update"; mapping: ExpenseTypeMapping }
  | { ok: true; intent: "delete"; id: number }
  | { ok: false; error: string };

function parseMappingInput(form: FormData): ExpenseTypeMappingInput {
  const taxRaw = form.get("tax_indicator_id");
  const tax = taxRaw == null || String(taxRaw) === "" ? null : Number(taxRaw);
  return {
    receipt_type_id: Number(form.get("receipt_type_id")),
    cargo_account_id: Number(form.get("cargo_account_id")),
    abono_account_id: Number(form.get("abono_account_id")),
    tax_indicator_id: tax,
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
      const mapping = await runInTenant(session, async () =>
        createExpenseTypeMapping(orgId, parseMappingInput(form)),
      );
      return Response.json(
        { ok: true, intent: "create", mapping } satisfies ExpenseTypeMappingActionResult,
        { status: 201 },
      );
    }
    if (intent === "update") {
      const id = Number(form.get("id"));
      const mapping = await runInTenant(session, async () =>
        updateExpenseTypeMapping(orgId, id, parseMappingInput(form)),
      );
      return Response.json(
        { ok: true, intent: "update", mapping } satisfies ExpenseTypeMappingActionResult,
        { status: 200 },
      );
    }
    if (intent === "delete") {
      const id = Number(form.get("id"));
      await runInTenant(session, async () => deleteExpenseTypeMapping(orgId, id));
      return Response.json(
        { ok: true, intent: "delete", id } satisfies ExpenseTypeMappingActionResult,
        { status: 200 },
      );
    }
    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies ExpenseTypeMappingActionResult,
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
      { ok: false, error: message } satisfies ExpenseTypeMappingActionResult,
      { status },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as MapeoGastosLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Mapeo</p>
        <h1 className="font-serif text-3xl md:text-4xl">Mapeo de gastos</h1>
      </header>
      <ExpenseTypeMappingAdmin
        initialMappings={data.mappings}
        initialAccounts={data.accounts}
        initialReceiptTypes={data.receiptTypes}
        initialTaxIndicators={data.taxIndicators}
        csrfToken={data.csrfToken}
      />
    </section>
  );
}
