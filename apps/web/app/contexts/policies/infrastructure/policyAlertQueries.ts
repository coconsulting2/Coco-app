/**
 * @module policyAlertQueries
 * @description Adapter Prisma del puerto PolicyAlertQueriesPort. Queries usadas
 * por policyAlertService para la pre-evaluación de receipts (RF-44).
 */
import prisma from "~/platform/db/prisma.server.js";
import type { TravelPolicyRow } from "~/contexts/policies/domain/types";

export interface RouteRequestRow {
  route: {
    idOriginCountry: number | null;
    idDestinationCountry: number | null;
  } | null;
}

export interface RequestForPolicyPreview {
  requestId: number;
  policyEvaluationSnapshot: PolicyEvaluationSnapshot | null;
  user: { organizationId: bigint | number } | null;
  routeRequests: RouteRequestRow[];
}

export interface PolicyEvaluationSnapshot {
  policyId?: number;
  name?: string;
  categoryId?: number | null;
  destinationScope?: string;
  costsCenter?: string | null;
  dailyPerDiem?: number | null;
  currency?: string;
  validFrom?: string;
  validTo?: string | null;
  caps?: Array<{
    capId: number;
    receiptTypeId: number;
    capAmount: number;
    capUnit: string;
    currency: string;
  }>;
}

export interface PolicyAlertQueriesPort {
  findRequestForPolicyPreview(requestId: number): Promise<RequestForPolicyPreview | null>;
  listActivePoliciesForOrg(organizationId: bigint | number): Promise<TravelPolicyRow[]>;
}

export async function findRequestForPolicyPreview(
  requestId: number,
): Promise<RequestForPolicyPreview | null> {
  return prisma.request.findUnique({
    where: { requestId: Number(requestId) },
    select: {
      requestId: true,
      policyEvaluationSnapshot: true,
      user: { select: { organizationId: true } },
      routeRequests: { include: { route: true } },
    },
  }) as unknown as Promise<RequestForPolicyPreview | null>;
}

export async function listActivePoliciesForOrg(
  organizationId: bigint | number,
): Promise<TravelPolicyRow[]> {
  return prisma.travelPolicy.findMany({
    where: { organizationId, active: true },
    include: { expenseCaps: true },
  }) as unknown as Promise<TravelPolicyRow[]>;
}

/** Adapter pre-wireado del puerto PolicyAlertQueriesPort. */
export const prismaPolicyAlertQueries: PolicyAlertQueriesPort = {
  findRequestForPolicyPreview,
  listActivePoliciesForOrg,
};
