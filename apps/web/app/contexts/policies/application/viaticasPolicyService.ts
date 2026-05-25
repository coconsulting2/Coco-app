/**
 * @module viaticasPolicyService
 * @description Use-cases de validación + lectura/escritura de la política de
 * viáticos. No toca Prisma directo — usa puertos en domain/ports (adapters en
 * infrastructure/). Recibe las dependencias por DI.
 */
import ViaticasPolicy from "~/contexts/policies/infrastructure/viaticasPolicyModel.js";
import { prismaViaticosUserQueries } from "~/contexts/policies/infrastructure/viaticasPolicyQueries.js";
import type {
  ViaticosPolicyRepositoryPort,
  ViaticosUserQueriesPort,
} from "~/contexts/policies/domain/ports/ViaticosPolicyPort";
import {
  httpError,
  type ViaticosPolicyPayload,
  type ViaticosPolicyRow,
} from "~/contexts/policies/domain/types";

export interface ViaticasPolicyServiceDeps {
  repository: ViaticosPolicyRepositoryPort;
  userQueries: ViaticosUserQueriesPort;
}

const defaultDeps: ViaticasPolicyServiceDeps = {
  repository: ViaticasPolicy,
  userQueries: prismaViaticosUserQueries,
};

/**
 * Checks if the requested fee for a travel request exceeds the org's viaticos
 * policy. Uses hotel_needed to determine which cap applies: maxHotel if
 * hotel_needed, else maxMeal. Throws { status: 422 } when the fee exceeds the
 * applicable cap.
 */
export async function checkFeeVsViaticosPolicy(
  applicantId: number,
  requestedFee: number,
  hotelNeeded: boolean,
  deps: ViaticasPolicyServiceDeps = defaultDeps,
): Promise<void> {
  const organizationId = await deps.userQueries.getUserOrganizationId(applicantId);
  if (!organizationId) return;

  const policy = await deps.repository.getByOrg(organizationId);
  if (!policy || !policy.active) return;

  const cap = hotelNeeded ? policy.max_hotel : policy.max_meal;
  const label = hotelNeeded ? "hotel" : "comidas";

  if (Number(requestedFee) > cap) {
    throw httpError(
      `La tarifa solicitada (${requestedFee} ${policy.currency}) excede el tope de ${label} definido en la política de viáticos (${cap} ${policy.currency}).`,
      422,
    );
  }
}

/**
 * Lectura de la política de viáticos de una organización. El caller resuelve el
 * organizationId desde la sesión (paridad con el legacy `resolveOrgId`).
 */
export async function getViaticosPolicy(
  organizationId: bigint | number,
  deps: ViaticasPolicyServiceDeps = defaultDeps,
): Promise<ViaticosPolicyRow | null> {
  return deps.repository.getByOrg(organizationId);
}

/** Upsert de la política de viáticos para una organización. */
export async function setViaticosPolicy(
  organizationId: bigint | number,
  payload: ViaticosPolicyPayload,
  deps: ViaticasPolicyServiceDeps = defaultDeps,
): Promise<ViaticosPolicyRow> {
  return deps.repository.upsert(organizationId, payload);
}
