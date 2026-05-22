/**
 * @module approverResolverGlobal
 * @description Adapter que inyecta el prisma client global al use-case puro
 * `resolveN1N2Approvers` (que ya recibe `db` por parámetro — DI-style).
 *
 * Refactor Fase 6: el use-case principal no toca prisma (recibe el cliente
 * por parámetro). Esta función conveniente solo lo provee desde infrastructure.
 */
import prisma from "~/platform/db/prisma.server.js";
import { resolveN1N2Approvers } from "~/contexts/approvals/application/approverResolver.js";

/**
 * @param {bigint | null | undefined} organizationId
 * @param {number | null | undefined} departmentId
 * @param {number | null | undefined} userId
 */
export async function resolveN1N2ApproversGlobal(organizationId, departmentId, userId) {
  return resolveN1N2Approvers(prisma, organizationId, departmentId, userId);
}
