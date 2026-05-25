/**
 * @module gastos-por-centro
 * @description Reporte de gastos por centro de costo. El loader consume el
 * use-case hex tipado `getExpensesByCC` (port `ExpenseReportQueries` + adapter
 * Prisma) dentro de `runInTenant` — sin endpoint HTTP intermedio ni
 * `@ts-ignore`. Render mínimo en React puro, prop-driven desde el loader.
 */
import type { LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import {
  getExpensesByCC,
  AccountsPayableError,
} from "~/contexts/accounts-payable";

export function meta() {
  return [{ title: "Gastos por centro de costo — CocoConsulting" }];
}

type ReportRow = {
  costsCenter: string;
  count: number;
  total: number;
};

export type GastosPorCentroLoaderData = {
  rows: ReportRow[];
  total: number | null;
  from: string;
  to: string;
};

export async function loader({
  request,
}: LoaderFunctionArgs): Promise<GastosPorCentroLoaderData> {
  const session = await requirePermissions(request, "report:read");
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  if (!from || !to) {
    return { rows: [], total: null, from, to };
  }

  try {
    const orgId = Number(session.organizationId);
    const report = await runInTenant(session, async () =>
      getExpensesByCC({
        orgId,
        actorUserId: Number(session.user.user_id),
        permissionSet: session.user.permissionSet,
        query: { from, to },
      }),
    );

    // Agrega las filas (por periodo/tipo) en un total por centro de costo.
    const byCc = new Map<string, ReportRow>();
    for (const row of report.rows) {
      const key = row.cost_center_code || row.cost_center_name || "—";
      const current = byCc.get(key) ?? { costsCenter: key, count: 0, total: 0 };
      current.count += 1;
      current.total += row.amount;
      byCc.set(key, current);
    }
    const rows = [...byCc.values()].sort((a, b) => b.total - a.total);
    const total = rows.reduce((sum, r) => sum + r.total, 0);

    return { rows, total, from, to };
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof AccountsPayableError) {
      return { rows: [], total: null, from, to };
    }
    return { rows: [], total: null, from, to };
  }
}

export default function GastosPorCentroRoute() {
  const data = useLoaderData() as GastosPorCentroLoaderData;

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
                  Comprobantes
                </th>
                <th className="text-right text-xs uppercase tracking-widest text-[var(--color-ink-muted)] px-4 py-3">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--color-neutral-200)]">
                  <td className="px-4 py-3 text-sm">{r.costsCenter}</td>
                  <td className="px-4 py-3 text-sm">{r.count}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    ${r.total.toFixed(2)}
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
