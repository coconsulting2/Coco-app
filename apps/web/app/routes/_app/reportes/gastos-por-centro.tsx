// @ts-nocheck — legacy route/view props mismatch; M11 UI follow-up
/**
 * @module gastos-por-centro
 * @description Reporte de gastos por centro de costo. Loader llama
 * directamente al service legacy (DI) — sin endpoint HTTP intermedio.
 * Render mínimo en React puro (sin componente legacy ad-hoc).
 */
import type { LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";

import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JS module
import * as expenseReportService from "~/contexts/accounts-payable/application/expenseReportService.js";

export function meta() {
  return [{ title: "Gastos por centro de costo — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "report:read");
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  let rows: any[] = [];
  let total: number | null = null;
  if (from && to) {
    try {
      const result = await runInTenant(session, async () =>
        expenseReportService.getExpensesByCC?.({
          from,
          to,
          userId: session.user.user_id,
        }),
      );
      if (Array.isArray(result)) {
        rows = result;
      } else if (result && typeof result === "object") {
        rows = result.items ?? result.data ?? [];
        total = result.total ?? null;
      }
    } catch {
      rows = [];
    }
  }

  return { rows, total, from, to };
}

type Row = {
  costsCenter?: string | null;
  centroCosto?: string | null;
  total?: number | null;
  amount?: number | null;
  count?: number | null;
};

export default function GastosPorCentroRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Reportes
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Gastos por centro de costo</h1>
        <p className="text-[var(--color-ink-muted)]">
          Total gastado por centro en el rango seleccionado.
        </p>
      </header>

      <Form method="get" className="bg-white border border-[var(--color-neutral-200)] rounded-lg p-5 flex gap-4 items-end flex-wrap">
        <DateField name="from" label="Desde" defaultValue={data.from} />
        <DateField name="to" label="Hasta" defaultValue={data.to} />
        <button
          type="submit"
          className="px-4 py-2 text-sm rounded-md bg-[var(--color-primary-500,#3D4A2A)] text-white hover:opacity-90"
        >
          Generar reporte
        </button>
      </Form>

      {data.rows.length === 0 ? (
        <article className="text-center py-16 border border-dashed border-[var(--color-neutral-200)] rounded-lg">
          <p className="text-[var(--color-ink-muted)]">
            {data.from && data.to
              ? "Sin gastos en el rango seleccionado."
              : "Selecciona un rango de fechas para generar el reporte."}
          </p>
        </article>
      ) : (
        <article className="bg-white border border-[var(--color-neutral-200)] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-secondary)]">
              <tr>
                <th className="text-left text-xs uppercase tracking-widest text-[var(--color-ink-muted)] px-4 py-3">
                  Centro de costo
                </th>
                <th className="text-left text-xs uppercase tracking-widest text-[var(--color-ink-muted)] px-4 py-3">
                  Solicitudes
                </th>
                <th className="text-right text-xs uppercase tracking-widest text-[var(--color-ink-muted)] px-4 py-3">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.rows as Row[]).map((r, i) => (
                <tr key={i} className="border-t border-[var(--color-neutral-200)]">
                  <td className="px-4 py-3 text-sm">{r.costsCenter ?? r.centroCosto ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">{r.count ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {r.total != null ? `$${Number(r.total).toFixed(2)}` : r.amount != null ? `$${Number(r.amount).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {data.total != null && (
              <tfoot>
                <tr className="border-t border-[var(--color-neutral-300)] bg-[var(--color-surface-secondary)]">
                  <td colSpan={2} className="px-4 py-3 text-sm font-medium">Total</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    ${Number(data.total).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </article>
      )}
    </section>
  );
}

function DateField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs uppercase tracking-widest text-[var(--color-ink-muted)] mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="date"
        defaultValue={defaultValue}
        className="border-b border-[rgba(10,10,10,0.2)] bg-transparent py-2 outline-none focus:border-[var(--color-primary-500)]"
      />
    </div>
  );
}
