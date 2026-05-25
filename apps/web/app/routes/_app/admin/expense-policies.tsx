/**
 * @module expense-policies
 * @description Admin de políticas de viáticos (M2-006 RF-42/43/46). El loader
 * precarga el catálogo (políticas + categorías) vía use-cases hex del slice
 * policies; la action discrimina por `intent` (create | update | delete) y
 * llama a los use-cases con DI. El componente es prop-driven + useFetcher
 * (sin apiRequest).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
  runInRls,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deactivatePolicy,
  listCategories,
  PoliciesError,
  type PolicyPayload,
} from "~/contexts/policies";
import ExpensePoliciesAdmin, {
  type CategoryProp,
  type PolicyProp,
} from "~/shared/ui/ExpensePoliciesAdmin";

function num(v: number | string | { toNumber(): number } | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "toNumber" in v) return v.toNumber();
  return Number(v);
}

function asIso(v: Date | string | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export function meta() {
  return [{ title: "Políticas de viáticos — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "policy:manage");
  const { policies, categories } = await runInTenant(session, async () => ({
    policies: await listPolicies(session.organizationId, { activeOnly: false }),
    categories: await listCategories(session.organizationId),
  }));

  const mappedPolicies: PolicyProp[] = policies.map((p) => ({
    policyId: p.policyId,
    name: p.name,
    categoryId: p.categoryId,
    destinationScope: p.destinationScope,
    costsCenter: p.costsCenter,
    dailyPerDiem: num(p.dailyPerDiem),
    currency: p.currency,
    validFrom: asIso(p.validFrom) ?? "",
    validTo: asIso(p.validTo),
    active: p.active,
    expenseCaps: (p.expenseCaps ?? []).map((c) => ({
      capId: c.capId,
      receiptTypeId: c.receiptTypeId,
      capAmount: num(c.capAmount) ?? 0,
      capUnit: c.capUnit,
      currency: c.currency,
    })),
  }));

  const mappedCategories: CategoryProp[] = categories.map((c) => ({
    categoryId: c.categoryId,
    name: c.name,
    code: c.code,
  }));

  return { policies: mappedPolicies, categories: mappedCategories };
}

export type ExpensePoliciesLoaderData = Awaited<ReturnType<typeof loader>>;

export type ExpensePoliciesActionData =
  | { ok: true; intent: string }
  | { ok: false; error: string; code?: string };

function parsePayload(formData: FormData): PolicyPayload {
  const raw = String(formData.get("payload") ?? "{}");
  return JSON.parse(raw) as PolicyPayload;
}

export async function action({
  request,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "policy:manage");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "create") {
      const payload = parsePayload(formData);
      await runInRls(session, async () =>
        createPolicy(session.organizationId, payload),
      );
      return Response.json({ ok: true, intent } satisfies ExpensePoliciesActionData);
    }

    if (intent === "update") {
      const policyId = Number(formData.get("policyId"));
      const payload = parsePayload(formData);
      await runInRls(session, async () =>
        updatePolicy(policyId, session.organizationId, payload),
      );
      return Response.json({ ok: true, intent } satisfies ExpensePoliciesActionData);
    }

    if (intent === "delete") {
      const policyId = Number(formData.get("policyId"));
      await runInRls(session, async () =>
        deactivatePolicy(policyId, session.organizationId),
      );
      return Response.json({ ok: true, intent } satisfies ExpensePoliciesActionData);
    }

    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies ExpensePoliciesActionData,
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof PoliciesError) {
      return Response.json(
        { ok: false, error: err.message, code: err.code } satisfies ExpensePoliciesActionData,
        { status: err.status },
      );
    }
    const status = (err as { status?: number })?.status ?? 500;
    const msg = err instanceof Error ? err.message : "No se pudo completar la acción.";
    return Response.json(
      { ok: false, error: msg } satisfies ExpensePoliciesActionData,
      { status },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as ExpensePoliciesLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Políticas</p>
        <h1 className="font-serif text-3xl md:text-4xl">Políticas de viáticos</h1>
      </header>
      <ExpensePoliciesAdmin policies={data.policies} categories={data.categories} />
    </section>
  );
}
