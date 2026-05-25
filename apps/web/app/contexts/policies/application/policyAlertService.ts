/**
 * @module policyAlertService
 * @description Helper liviano para el endpoint POST /api/policies/preview
 * (M2-006 RF-44). Resuelve la política aplicable de la solicitud y evalúa un
 * receipt hipotético. Recibe el puerto de queries por DI.
 */
import {
  evaluateReceiptAgainstPolicy,
  findApplicablePolicy,
  type CapBreach,
  type DestinationScope,
  type ExpenseCapRow as EngineExpenseCapRow,
  type TravelPolicyRow as EngineTravelPolicyRow,
} from "~/contexts/refunds/application/refundRuleEngine.js";
import { prismaPolicyAlertQueries } from "~/contexts/policies/infrastructure/policyAlertQueries.js";
import type {
  PolicyAlertQueriesPort,
  RequestForPolicyPreview,
} from "~/contexts/policies/infrastructure/policyAlertQueries.js";
import { httpError } from "~/contexts/policies/domain/types";

export interface PolicyAlertServiceDeps {
  queries: PolicyAlertQueriesPort;
}

const defaultDeps: PolicyAlertServiceDeps = { queries: prismaPolicyAlertQueries };

export interface CheckReceiptInput {
  requestId: number;
  receiptTypeId: number;
  amount: number;
  currency?: string;
  nights?: number;
  days?: number;
  categoryId?: number | null;
  costsCenter?: string | null;
}

export interface CheckReceiptResult {
  exceeded: boolean;
  policyId: number | null;
  capId: number | null;
  capAmount: number | null;
  capUnit: string | null;
  currency: string;
  excessTotal: number;
  message: string;
}

function inferDestinationScope(request: RequestForPolicyPreview): DestinationScope {
  const snap = request.policyEvaluationSnapshot;
  if (snap && snap.destinationScope) return snap.destinationScope as DestinationScope;

  const routes = request.routeRequests || [];
  const isInternational = routes.some((rr) => {
    const r = rr.route;
    if (!r) return false;
    if (r.idOriginCountry == null || r.idDestinationCountry == null) return false;
    return Number(r.idOriginCountry) !== Number(r.idDestinationCountry);
  });
  return isInternational ? "internacional" : "nacional";
}

/**
 * Pre-evaluación de un receipt aún no creado contra la política aplicable a la
 * solicitud. Usa Request.policyEvaluationSnapshot si existe (RF-46 no
 * retroactividad); si no, busca en vivo.
 */
export async function checkReceiptBeforeSubmit(
  input: CheckReceiptInput,
  deps: PolicyAlertServiceDeps = defaultDeps,
): Promise<CheckReceiptResult> {
  const requestId = Number(input.requestId);
  const request = await deps.queries.findRequestForPolicyPreview(requestId);
  if (!request) {
    throw httpError(`Solicitud ${requestId} no encontrada.`, 404);
  }

  const snapshot = request.policyEvaluationSnapshot;
  let policy: EngineTravelPolicyRow | null = null;
  let caps: EngineExpenseCapRow[] = [];

  if (snapshot && snapshot.policyId) {
    policy = {
      policyId: snapshot.policyId,
      organizationId: request.user?.organizationId ?? 0,
      name: snapshot.name ?? "",
      categoryId: snapshot.categoryId ?? null,
      destinationScope: (snapshot.destinationScope as DestinationScope) || "any",
      costsCenter: snapshot.costsCenter ?? null,
      dailyPerDiem: snapshot.dailyPerDiem ?? null,
      currency: snapshot.currency || "MXN",
      validFrom: snapshot.validFrom ?? new Date().toISOString(),
      validTo: snapshot.validTo ?? null,
      active: true,
    };
    caps = (snapshot.caps || []).map((c) => ({
      capId: c.capId,
      policyId: snapshot.policyId as number,
      receiptTypeId: c.receiptTypeId,
      capAmount: c.capAmount,
      capUnit: c.capUnit as EngineExpenseCapRow["capUnit"],
      currency: c.currency,
    }));
  } else if (request.user && request.user.organizationId) {
    const policies = await deps.queries.listActivePoliciesForOrg(request.user.organizationId);
    policy = findApplicablePolicy(policies as unknown as EngineTravelPolicyRow[], {
      categoryId: input.categoryId ?? null,
      destinationScope: inferDestinationScope(request),
      costsCenter: input.costsCenter ?? null,
      evaluationDate: new Date(),
    });
    caps = policy
      ? ((policy as { expenseCaps?: EngineExpenseCapRow[] }).expenseCaps ?? [])
      : [];
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

  let topBreach: CapBreach | null = null;
  for (const b of result.excessByCap) {
    if (b.excess > 0 && (!topBreach || b.excessTotal > topBreach.excessTotal)) topBreach = b;
  }

  const fmt = (n: number) => Number(n).toFixed(2);
  let message = "";
  if (result.exceeded && topBreach) {
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

// ── Aliases de paridad con la API pública del slice ─────────────────────────
export const previewReceipt = checkReceiptBeforeSubmit;
export const raisePolicyAlert = checkReceiptBeforeSubmit;
