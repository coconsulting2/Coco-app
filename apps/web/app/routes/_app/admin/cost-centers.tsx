/**
 * @module admin/cost-centers
 * @description Admin de centros de costo. El loader precarga los centros vía el
 * use-case hex `loadAccountingCatalog`. La `action` expone create/update/delete
 * que invocan `createCostCenter` / `updateCostCenter` / `deleteCostCenter`
 * (DI → port → adapter Prisma sobre Department), dentro de
 * `requirePermissions` + `assertCsrf` + `runInTenant`. `CostCenterAdmin` es
 * prop-driven + `useFetcher` — cero apiRequest.
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
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
  AccountsPayableError,
  type CostCenterEntity,
  type CostCenterInput,
} from "~/contexts/accounts-payable";
import CostCenterAdmin from "~/shared/ui/CostCenterAdmin";

export function meta() {
  return [{ title: "Centros de costo — CocoConsulting" }];
}

export type CostCentersLoaderData = {
  costCenters: CostCenterEntity[];
  csrfToken: string;
};

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "accounting:export");
  const orgId = Number(session.organizationId);
  const snapshot = await runInTenant(session, async () => loadAccountingCatalog(orgId));
  const csrf = issueCsrfToken(request);

  const payload: CostCentersLoaderData = {
    costCenters: snapshot.costCenters,
    csrfToken: csrf.token,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": csrf.setCookie },
  });
}

export type CostCenterActionResult =
  | { ok: true; intent: "create" | "update"; costCenter: CostCenterEntity }
  | { ok: true; intent: "delete"; id: number }
  | { ok: false; error: string };

function parseCostCenterInput(form: FormData): CostCenterInput {
  const parentRaw = form.get("parent_id");
  const parent = parentRaw == null || String(parentRaw) === "" ? null : Number(parentRaw);
  return {
    code: String(form.get("code") ?? ""),
    name: String(form.get("name") ?? ""),
    parent_id: parent,
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
      const costCenter = await runInTenant(session, async () =>
        createCostCenter(orgId, parseCostCenterInput(form)),
      );
      return Response.json(
        { ok: true, intent: "create", costCenter } satisfies CostCenterActionResult,
        { status: 201 },
      );
    }
    if (intent === "update") {
      const id = Number(form.get("id"));
      const costCenter = await runInTenant(session, async () =>
        updateCostCenter(orgId, id, parseCostCenterInput(form)),
      );
      return Response.json(
        { ok: true, intent: "update", costCenter } satisfies CostCenterActionResult,
        { status: 200 },
      );
    }
    if (intent === "delete") {
      const id = Number(form.get("id"));
      await runInTenant(session, async () => deleteCostCenter(orgId, id));
      return Response.json(
        { ok: true, intent: "delete", id } satisfies CostCenterActionResult,
        { status: 200 },
      );
    }
    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies CostCenterActionResult,
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
      { ok: false, error: message } satisfies CostCenterActionResult,
      { status },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as CostCentersLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / CCs</p>
        <h1 className="font-serif text-3xl md:text-4xl">Centros de costo</h1>
      </header>
      <CostCenterAdmin initialData={data.costCenters} csrfToken={data.csrfToken} />
    </section>
  );
}
