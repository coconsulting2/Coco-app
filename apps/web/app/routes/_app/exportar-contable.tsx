/**
 * @module exportar-contable
 * @description Página CxP: exportación contable al ERP (pólizas AV/GV por rango).
 * El loader lee el rango de fechas del query string y consume el use-case
 * pre-wired `getAccountingPolizasInRange` (port + adapter Prisma) dentro de
 * `runInTenant`. La descarga JSON pasa por una `action` RR7 con `assertCsrf`.
 * El panel es prop-driven: recibe `{ polizas, from, to }` y usa `<Form method="get">`
 * para filtrar. Sin `apiRequest`/`fetch('/api/...')`.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf, issueCsrfToken } from "~/platform/csrf/csrf.server";
import {
  getAccountingPolizasInRange,
  AccountsPayableError,
  type GetAccountingPolizasInRangeResult,
} from "~/contexts/accounts-payable";
import AccountingExportPanel from "~/shared/ui/AccountingExportPanel";

export function meta() {
  return [{ title: "Exportar contabilidad — CocoConsulting" }];
}

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ExportarContableLoaderData =
  | { ok: true; result: GetAccountingPolizasInRangeResult; force: boolean; csrfToken: string }
  | { ok: false; error: string; from: string; to: string; force: boolean; csrfToken: string };

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounting:export");
  const url = new URL(request.url);

  const from = url.searchParams.get("date_from") ?? thirtyDaysAgoIso();
  const to = url.searchParams.get("date_to") ?? todayIso();
  const force = url.searchParams.get("status") === "Sincronizado";
  const csrf = issueCsrfToken(request);

  let payload: ExportarContableLoaderData;
  try {
    const result = await runInTenant(session, async () =>
      getAccountingPolizasInRange({ from, to, force }),
    );
    payload = { ok: true, result, force, csrfToken: csrf.token };
  } catch (err) {
    if (err instanceof Response) throw err;
    const message =
      err instanceof AccountsPayableError
        ? err.message
        : err instanceof Error
          ? err.message
          : "No se pudieron obtener las pólizas.";
    payload = { ok: false, error: message, from, to, force, csrfToken: csrf.token };
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

export type ExportarContableActionData =
  | { ok: true; filename: string; json: string }
  | { ok: false; error: string };

export async function action({
  request,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounting:export");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  if (intent !== "download-json") {
    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies ExportarContableActionData,
      { status: 400 },
    );
  }

  const from = String(formData.get("date_from") ?? "");
  const to = String(formData.get("date_to") ?? "");
  const force = String(formData.get("status") ?? "") === "Sincronizado";

  try {
    const result = await runInTenant(session, async () =>
      getAccountingPolizasInRange({ from, to, force }),
    );
    const json = JSON.stringify({ polizas: result.polizas }, null, 2);
    const filename = `polizas_${result.from}_${result.to}.json`;
    return Response.json(
      { ok: true, filename, json } satisfies ExportarContableActionData,
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    const message =
      err instanceof AccountsPayableError
        ? err.message
        : err instanceof Error
          ? err.message
          : "No se pudo generar la descarga.";
    return Response.json(
      { ok: false, error: message } satisfies ExportarContableActionData,
      { status: 400 },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as ExportarContableLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Contabilidad</p>
        <h1 className="font-serif text-3xl md:text-4xl">Exportar contabilidad</h1>
      </header>
      <AccountingExportPanel data={data} />
    </section>
  );
}
