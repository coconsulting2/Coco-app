/**
 * @module applicantQueryService
 * @description Use-cases de consulta del slice travel-requests. Wrapper
 * thin sobre `applicantModel`; los routes invocan estas funciones (NUNCA
 * el modelo directamente). Mantiene la regla "routes no tocan infrastructure".
 */
import Applicant from "~/contexts/travel-requests/infrastructure/applicantModel.js";

/**
 * Lista las solicitudes completadas/archivadas del usuario.
 * @param {number} userId
 * @returns {Promise<Array<object>>}
 */
export async function listCompletedRequests(userId) {
  return Applicant.getCompletedRequests(userId);
}

/**
 * Lista TODAS las solicitudes activas del usuario (pendientes + en flujo).
 * No incluye canceladas/rechazadas/finalizadas.
 * @param {number} userId
 * @returns {Promise<Array<object>>}
 */
export async function listActiveRequests(userId) {
  return Applicant.getApplicantRequests(userId);
}

/**
 * Lista solo borradores del usuario (status "Borrador" / "draft").
 * @param {number} userId
 * @returns {Promise<Array<object>>}
 */
export async function listDrafts(userId) {
  const all = await Applicant.getApplicantRequests(userId);
  if (!Array.isArray(all)) return [];
  return all.filter((r) => {
    const status = String(r.status ?? "").toLowerCase();
    return status === "borrador" || status === "draft";
  });
}

/**
 * Detalle de una solicitud (joins de routes + user).
 * @param {number} requestId
 * @returns {Promise<object|null>}
 */
export async function getRequestDetail(requestId) {
  return Applicant.getApplicantRequest(requestId);
}

/**
 * Centro de costos del usuario (lookup para formularios).
 * @param {number} userId
 * @returns {Promise<{id: number, name: string}|null>}
 */
export async function getCostCenterForUser(userId) {
  return Applicant.findCostCenterByUserId(userId);
}
