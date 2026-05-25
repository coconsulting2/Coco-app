/**
 * @module employee-categories
 * @description Admin de categorías de empleado (M2-006 RF-42). El loader
 * precarga el catálogo de categorías vía use-case hex del slice policies; la
 * action discrimina por `intent` (create | update | delete) y llama a los
 * use-cases con DI. El componente es prop-driven + useFetcher (sin apiRequest).
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
  listCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  PoliciesError,
  type CategoryPayload,
} from "~/contexts/policies";
import EmployeeCategoriesAdmin, {
  type CategoryRow,
} from "~/shared/ui/EmployeeCategoriesAdmin";

export function meta() {
  return [{ title: "Categorías de empleado — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "policy:manage");
  const categories = await runInTenant(session, async () =>
    listCategories(session.organizationId),
  );
  const mapped: CategoryRow[] = categories.map((c) => ({
    categoryId: c.categoryId,
    code: c.code,
    name: c.name,
    description: c.description,
    active: c.active,
  }));
  return { categories: mapped };
}

export type EmployeeCategoriesLoaderData = Awaited<ReturnType<typeof loader>>;

export type EmployeeCategoriesActionData =
  | { ok: true; intent: string }
  | { ok: false; error: string; code?: string };

function parsePayload(formData: FormData): CategoryPayload {
  const raw = String(formData.get("payload") ?? "{}");
  return JSON.parse(raw) as CategoryPayload;
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
        createCategory(session.organizationId, payload),
      );
      return Response.json({ ok: true, intent } satisfies EmployeeCategoriesActionData);
    }

    if (intent === "update") {
      const categoryId = Number(formData.get("categoryId"));
      const payload = parsePayload(formData);
      await runInRls(session, async () =>
        updateCategory(categoryId, session.organizationId, payload),
      );
      return Response.json({ ok: true, intent } satisfies EmployeeCategoriesActionData);
    }

    if (intent === "delete") {
      const categoryId = Number(formData.get("categoryId"));
      await runInRls(session, async () =>
        deactivateCategory(categoryId, session.organizationId),
      );
      return Response.json({ ok: true, intent } satisfies EmployeeCategoriesActionData);
    }

    return Response.json(
      { ok: false, error: `Intent desconocido: ${intent}` } satisfies EmployeeCategoriesActionData,
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof PoliciesError) {
      return Response.json(
        { ok: false, error: err.message, code: err.code } satisfies EmployeeCategoriesActionData,
        { status: err.status },
      );
    }
    const status = (err as { status?: number })?.status ?? 500;
    const msg = err instanceof Error ? err.message : "No se pudo completar la acción.";
    return Response.json(
      { ok: false, error: msg } satisfies EmployeeCategoriesActionData,
      { status },
    );
  }
}

export default function PageRoute() {
  const data = useLoaderData() as EmployeeCategoriesLoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">Coco / Admin / Categorías</p>
        <h1 className="font-serif text-3xl md:text-4xl">Categorías de empleado</h1>
      </header>
      <EmployeeCategoriesAdmin categories={data.categories} />
    </section>
  );
}
