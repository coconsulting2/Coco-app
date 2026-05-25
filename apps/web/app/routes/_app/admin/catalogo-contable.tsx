/**
 * @module admin/catalogo-contable
 * @description Admin del catálogo de cuentas contables. El loader precarga las
 * cuentas + mapeos (para el bloqueo de borrado de cuentas en uso) vía el
 * use-case hex `loadAccountingCatalog`. La `action` expone los intents
 * create/update/delete que invocan `createAccountingAccount` /
 * `updateAccountingAccount` / `deleteAccountingAccount` (DI → port → adapter),
 * dentro de `requirePermissions` + `assertCsrf` + `runInTenant`.
 * `AccountingAccountAdmin` es prop-driven + `useFetcher` — cero apiRequest.
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
  createAccountingAccount,
  updateAccountingAccount,
  deleteAccountingAccount,
  AccountsPayableError,
  type AccountingAccount,
  type ExpenseTypeMapping,
  type AccountingAccountInput,
} from "~/contexts/accounts-payable";
import AccountingAccountAdmin from "~/shared/ui/AccountingAccountAdmin";

export function meta() {
  return [{ title: "Catálogo contable — CocoConsulting" }];
}

export type CatalogoContableLoaderData = {
  accounts: AccountingAccount[];
  mappings: ExpenseTypeMapping[];
  csrfToken: string;
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounting:export");
  const orgId = Number(session.organizationId);
  const snapshot = await runInTenant(session, async () => loadAccountingCatalog(orgId));
  const csrf = issueCsrfToken(request);

  const payload: CatalogoContableLoaderData = {
    accounts: snapshot.accounts,
    mappings: snapshot.mappings,
    csrfToken: csrf.token,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

export type AccountingAccountActionResult =
  | { ok: true; intent: "create" | "update"; account: AccountingAccount }
  | { ok: true; intent: "delete"; id: number }
  | { ok: false; error: string };

function parseAccountInput(form: FormData): AccountingAccountInput {
  return {
    account_number: String(form.get("account_number") ?? ""),
    description: String(form.get("description") ?? ""),
    type: String(form.get("type") ?? "") as AccountingAccountInput["type"],
    currency: String(form.get("currency") ?? ""),
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
      const account = await runInTenant(session, async () =>
        createAccountingAccount(orgId, parseAccountInput(form)),
      );
      return Response.json(
        { ok: true, intent: "create", account } satisfies AccountingAccountActionResult,
        { status: 201 },
      );
    }
    if (intent === "update") {
      const id = Number(form.get("id"));
      const account = await runInTenant(session, async () =>
        updateAccountingAccount(orgId, id, parseAccountInput(form)),
      );
      return Response.json(
        { ok: true, intent: "update", account } satisfies AccountingAccountActionResult,
        { status: 200 },
      );
    }
    if (intent === "delete") {
      const id = Number(form.get("id"));
      await runInTenant(session, async () => deleteAccountingAccount(orgId, id));
      return Response.json(
        { ok: true, intent: "delete", id } satisfies AccountingAccountActionResult,
        { status: 200 },
      );
    }
    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies AccountingAccountActionResult,
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
      { ok: false, error: message } satisfies AccountingAccountActionResult,
      { status },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as CatalogoContableLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Contabilidad</p>
        <h1 className="font-serif text-3xl md:text-4xl">Catálogo contable</h1>
      </header>
      <AccountingAccountAdmin
        initialData={data.accounts}
        initialMappings={data.mappings}
        csrfToken={data.csrfToken}
      />
    </section>
  );
}
