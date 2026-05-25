/**
 * @module previewExpensePolicy
 * @description Use-case hexagonal del preview de política de gasto (M2-006
 * RF-44). Pre-evalúa un comprobante aún no creado contra la política aplicable
 * a la solicitud y devuelve el resultado del tope (cap, si excede, exceso y un
 * mensaje legible) — sin lanzar. Paridad 1:1 con el legacy `POST
 * /policies/preview` (`policyAlertService.checkReceiptBeforeSubmit`).
 *
 * Es puro: recibe las lecturas por el port `ExpensePolicyPreviewQueries` (DI) y
 * delega el cálculo en el motor puro de `refunds` (`findApplicablePolicy` +
 * `evaluateReceiptAgainstPolicy`). Sin Prisma.
 */
import {
  evaluateReceiptAgainstPolicy,
  findApplicablePolicy,
  type ExpenseCapRow,
  type TravelPolicyRow,
} from "~/contexts/refunds/application/refundRuleEngine.js";
import type {
  ActivePolicyWithCaps,
  ExpensePolicyPreviewQueries,
  RequestPreviewContext,
} from "~/contexts/policies/domain/ports/ExpensePolicyPreviewQueries.js";
import { PolicyNotFoundError } from "~/contexts/policies/domain/errors.js";

export type PreviewExpensePolicyInput = {
  requestId: number;
  receiptTypeId: number;
  amount: number;
  currency?: string;
  nights?: number;
  days?: number;
  categoryId?: number | null;
  costsCenter?: string | null;
};

/**
 * Resultado del preview. Forma idéntica al contrato legacy `/policies/preview`
 * que consume `ExpensesForm` (`PolicyPreviewResult`).
 */
export type PreviewExpensePolicyResult = {
  exceeded: boolean;
  policyId: number | null;
  capId: number | null;
  capAmount: number | null;
  capUnit: string | null;
  currency: string;
  excessTotal: number;
  message: string;
};

export type PreviewExpensePolicyDeps = {
  queries: ExpensePolicyPreviewQueries;
};

/**
 * Infiere el scope de destino: usa el snapshot congelado si lo trae; si no,
 * heurística sobre las rutas (algún tramo con país origen != destino →
 * "internacional").
 */
function inferDestinationScope(
  request: RequestPreviewContext,
): "nacional" | "internacional" {
  const snap = request.policyEvaluationSnapshot;
  if (snap?.destinationScope === "internacional") return "internacional";
  if (snap?.destinationScope === "nacional") return "nacional";

  const routes = request.routeRequests ?? [];
  const isInternational = routes.some((rr) => {
    const r = rr.route;
    if (!r) return false;
    if (r.idOriginCountry == null || r.idDestinationCountry == null) return false;
    return Number(r.idOriginCountry) !== Number(r.idDestinationCountry);
  });
  return isInternational ? "internacional" : "nacional";
}

/**
 * Reconstruye `{ policy, caps }` desde el snapshot inmovilizado (RF-46 — no
 * retroactividad).
 */
function fromSnapshot(
  request: RequestPreviewContext,
): { policy: TravelPolicyRow; caps: ExpenseCapRow[] } {
  const snap = request.policyEvaluationSnapshot!;
  const policy: TravelPolicyRow = {
    policyId: snap.policyId,
    organizationId: request.organizationId ?? 0,
    name: snap.name ?? "",
    categoryId: snap.categoryId ?? null,
    destinationScope:
      snap.destinationScope === "nacional" || snap.destinationScope === "internacional"
        ? snap.destinationScope
        : "any",
    costsCenter: snap.costsCenter ?? null,
    dailyPerDiem: snap.dailyPerDiem ?? null,
    currency: snap.currency ?? "MXN",
    validFrom: snap.validFrom ?? new Date().toISOString(),
    validTo: snap.validTo ?? null,
    active: true,
  };
  const caps: ExpenseCapRow[] = (snap.caps ?? []).map((c) => ({
    capId: c.capId,
    policyId: snap.policyId,
    receiptTypeId: c.receiptTypeId,
    capAmount: c.capAmount,
    capUnit: c.capUnit,
    currency: c.currency,
  }));
  return { policy, caps };
}

/**
 * Resuelve la política aplicable en vivo (sin snapshot) para la org del
 * solicitante.
 */
function fromLiveLookup(
  policies: ActivePolicyWithCaps[],
  request: RequestPreviewContext,
  input: PreviewExpensePolicyInput,
): { policy: TravelPolicyRow | null; caps: ExpenseCapRow[] } {
  const policy = findApplicablePolicy(policies, {
    categoryId: input.categoryId ?? null,
    destinationScope: inferDestinationScope(request),
    costsCenter: input.costsCenter ?? null,
    evaluationDate: new Date(),
  });
  const caps = policy
    ? ((policy as ActivePolicyWithCaps).expenseCaps ?? [])
    : [];
  return { policy, caps };
}

export async function previewExpensePolicy(
  input: PreviewExpensePolicyInput,
  deps: PreviewExpensePolicyDeps,
): Promise<PreviewExpensePolicyResult> {
  const requestId = Number(input.requestId);
  const request = await deps.queries.findRequestContext(requestId);
  if (!request) {
    throw new PolicyNotFoundError(`Solicitud ${requestId} no encontrada.`);
  }

  let policy: TravelPolicyRow | null = null;
  let caps: ExpenseCapRow[] = [];

  if (request.policyEvaluationSnapshot?.policyId) {
    ({ policy, caps } = fromSnapshot(request));
  } else if (request.organizationId != null) {
    const policies = await deps.queries.listActivePoliciesForOrg(
      request.organizationId,
    );
    ({ policy, caps } = fromLiveLookup(policies, request, input));
  }

  const result = evaluateReceiptAgainstPolicy(
    {
      receiptTypeId: input.receiptTypeId,
      amount: Number(input.amount),
      currency: input.currency,
      nights: input.nights,
      days: input.days,
    },
    caps,
    policy,
  );

  // Selecciona el cap más restrictivo cuando hay exceso.
  let topBreach: (typeof result.excessByCap)[number] | null = null;
  for (const b of result.excessByCap) {
    if (b.excess > 0 && (!topBreach || b.excessTotal > topBreach.excessTotal)) {
      topBreach = b;
    }
  }

  let message: string;
  if (result.exceeded && topBreach) {
    const fmt = (n: number) => Number(n).toFixed(2);
    message =
      `Excede política: tope ${fmt(topBreach.capAmount)} ${topBreach.currency} (${topBreach.capUnit}); ` +
      `monto unitario ${fmt(topBreach.unitAmount)}, exceso total ${fmt(topBreach.excessTotal)}.`;
  } else if (!policy) {
    message = "No hay política aplicable; el monto se aceptará tal cual.";
  } else {
    message = "Dentro de la política.";
  }

  return {
    exceeded: result.exceeded,
    policyId: policy ? policy.policyId : null,
    capId: topBreach ? topBreach.capId : null,
    capAmount: topBreach ? topBreach.capAmount : null,
    capUnit: topBreach ? topBreach.capUnit : null,
    currency: result.snapshot.currency,
    excessTotal: topBreach ? topBreach.excessTotal : 0,
    message,
  };
}
