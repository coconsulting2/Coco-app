/**
 * @module workflow-rules
 * @description Admin de reglas de workflow por organización (M2). El loader
 * precarga rules + departments + roles vía use-cases hex del slice workflow.
 * El action discrimina por `intent` (create | update | toggle) y delega en los
 * use-cases. WorkflowRulesAdmin es prop-driven + useFetcher (sin apiRequest).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import {
  requirePermissions,
  runInTenant,
} from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  listWorkflowRules,
  listWorkflowRuleDepartments,
  listWorkflowRuleRoles,
  createWorkflowRule,
  updateWorkflowRule,
  toggleWorkflowRule,
  WorkflowError,
} from "~/contexts/workflow";
import type { WorkflowDepartment, WorkflowRule } from "~/contexts/workflow";
import WorkflowRulesAdmin from "~/shared/ui/admin/WorkflowRulesAdmin";
import type {
  WorkflowRuleDTO,
  WfRuleType,
  WfParamType,
} from "~/shared/types/WorkflowRuleTypes";

export function meta() {
  return [{ title: "Reglas de workflow — CocoConsulting" }];
}

function toDto(
  rule: WorkflowRule,
  deptIndex: Map<number, WorkflowDepartment>,
): WorkflowRuleDTO {
  const dept = rule.departmentId != null ? deptIndex.get(rule.departmentId) : undefined;
  return {
    id: rule.id.toString(),
    ruleType: rule.ruleType as WfRuleType,
    paramType: rule.paramType as WfParamType,
    threshold: rule.threshold,
    paramValue: rule.paramValue,
    approvalLevel: rule.approvalLevel,
    skipIfBelow: rule.skipIfBelow,
    priority: rule.priority,
    active: rule.active,
    departmentId: rule.departmentId,
    departmentName: dept?.departmentName ?? null,
    costsCenter: dept?.costsCenter ?? null,
    managerSteps: rule.managerSteps,
    targetRole: rule.targetRole,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "workflow:manage");
  const orgId = session.organizationId;

  const { rules, departments, roles } = await runInTenant(session, async () => {
    const [rules, departments, roles] = await Promise.all([
      listWorkflowRules(orgId),
      listWorkflowRuleDepartments(orgId),
      listWorkflowRuleRoles(orgId),
    ]);
    return { rules, departments, roles };
  });

  const deptIndex = new Map(departments.map((d) => [d.departmentId, d]));
  return {
    rules: rules.map((r) => toDto(r, deptIndex)),
    departments,
    roles,
  };
}

export type WorkflowRulesActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

function numOrNull(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(raw: FormDataEntryValue | null): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

export async function action({
  request,
}: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "workflow:manage");
  await assertCsrf(request);

  const orgId = session.organizationId;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "toggle") {
      const id = numOrNull(formData.get("id"));
      if (id == null) {
        return Response.json(
          { ok: false, error: "ID de regla inválido." } satisfies WorkflowRulesActionResult,
          { status: 400 },
        );
      }
      await runInTenant(session, async () => toggleWorkflowRule(id, orgId));
      return Response.json({ ok: true } satisfies WorkflowRulesActionResult);
    }

    if (intent === "create" || intent === "update") {
      const ruleType = strOrNull(formData.get("ruleType"));
      const paramType = strOrNull(formData.get("paramType"));
      if (!ruleType || !paramType) {
        return Response.json(
          {
            ok: false,
            error: "ruleType y paramType son obligatorios.",
          } satisfies WorkflowRulesActionResult,
          { status: 400 },
        );
      }

      const payload = {
        ruleType,
        paramType,
        threshold:
          paramType === "importe" ? numOrNull(formData.get("threshold")) : null,
        paramValue:
          paramType !== "importe" ? strOrNull(formData.get("paramValue")) : null,
        approvalLevel: numOrNull(formData.get("approvalLevel")) ?? 1,
        skipIfBelow: numOrNull(formData.get("skipIfBelow")),
        priority: numOrNull(formData.get("priority")) ?? 10,
        departmentId: numOrNull(formData.get("departmentId")),
        managerSteps: numOrNull(formData.get("managerSteps")),
        targetRole: strOrNull(formData.get("targetRole")),
      };

      if (intent === "create") {
        await runInTenant(session, async () =>
          createWorkflowRule({ ...payload, organizationId: orgId }),
        );
      } else {
        const id = numOrNull(formData.get("id"));
        if (id == null) {
          return Response.json(
            {
              ok: false,
              error: "ID de regla inválido.",
            } satisfies WorkflowRulesActionResult,
            { status: 400 },
          );
        }
        await runInTenant(session, async () => updateWorkflowRule(id, payload));
      }
      return Response.json({ ok: true } satisfies WorkflowRulesActionResult);
    }

    return Response.json(
      {
        ok: false,
        error: `Intent desconocido: ${intent}`,
      } satisfies WorkflowRulesActionResult,
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof WorkflowError) {
      return Response.json(
        {
          ok: false,
          error: err.message,
          code: err.code,
        } satisfies WorkflowRulesActionResult,
        { status: err.status },
      );
    }
    const msg =
      err instanceof Error ? err.message : "No se pudo completar la acción.";
    return Response.json(
      { ok: false, error: msg } satisfies WorkflowRulesActionResult,
      { status: 500 },
    );
  }
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function PageRoute() {
  const { rules, departments, roles } = useLoaderData() as LoaderData;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Admin / Workflow
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Reglas de workflow</h1>
      </header>
      <WorkflowRulesAdmin
        initialRules={rules}
        departments={departments}
        roles={roles}
      />
    </section>
  );
}
