// @ts-nocheck — bulk-converted legacy; typed properly is M9 follow-up
/**
 * @module viaticasPolicyService
 * @description Use-cases de validación contra política de viáticos. No toca
 * Prisma directo — usa el repositorio en infrastructure/.
 *
 * Refactor Fase 6: prisma.user.findUnique extraído a viaticasPolicyQueries.
 */
import ViaticasPolicy from "~/contexts/policies/infrastructure/viaticasPolicyModel.js";
import { getUserOrganizationId } from "~/contexts/policies/infrastructure/viaticasPolicyQueries.js";

/**
 * Checks if the requested fee for a travel request exceeds the org's viaticos policy.
 * Uses hotel_needed to determine which cap applies: maxHotel if hotel_needed, else maxMeal.
 * Throws { status: 422 } when the fee exceeds the applicable cap.
 *
 * @param {number} applicantId
 * @param {number} requestedFee
 * @param {boolean} hotelNeeded
 * @throws {{ status: number, message: string }}
 */
export async function checkFeeVsViaticosPolicy(applicantId, requestedFee, hotelNeeded) {
  const organizationId = await getUserOrganizationId(applicantId);
  if (!organizationId) return;

  const policy = await ViaticasPolicy.getByOrg(organizationId);
  if (!policy || !policy.active) return;

  const cap = hotelNeeded ? policy.max_hotel : policy.max_meal;
  const label = hotelNeeded ? "hotel" : "comidas";

  if (Number(requestedFee) > cap) {
    const err = new Error(
      `La tarifa solicitada (${requestedFee} ${policy.currency}) excede el tope de ${label} definido en la política de viáticos (${cap} ${policy.currency}).`,
    );
    err.status = 422;
    throw err;
  }
}

/**
 * Lectura directa de la política de viáticos del tenant activo (consumido
 * por el dispatcher /api/viaticos-policy).
 *
 * @param {bigint | number} [organizationId] - opcional; si se omite, usar el del tenant context.
 * @returns {Promise<object | null>}
 */
export async function getViaticosPolicy(organizationId) {
  if (organizationId == null) {
    // El tenant-extension de Prisma aplicará el orgId activo automáticamente
    // si la lectura ocurre dentro de runInTenant.
    return ViaticasPolicy.getCurrent?.();
  }
  return ViaticasPolicy.getByOrg(organizationId);
}

/**
 * Upsert de la política de viáticos.
 *
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function setViaticosPolicy(payload) {
  return ViaticasPolicy.upsertForCurrentOrg?.(payload);
}
