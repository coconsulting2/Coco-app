/**
 * @module tenantApplicantUserGrants
 * @description Persiste en `User_Permission` los códigos de la capacidad
 * solicitante del tenant. Idempotente (`skipDuplicates`). Complementa el
 * merge en runtime de `permissionService`.
 *
 * Refactor Fase 6: prisma extraído a tenantApplicantGrantQueries.js.
 */
import { TENANT_APPLICANT_CAPABILITY_CODES } from "~/shared/config/tenantApplicantCapability.js";
import {
  findActivePermissionsByCodes,
  grantUserPermissionsBulk,
} from "~/contexts/organizations/infrastructure/tenantApplicantGrantQueries.js";

/**
 * @param {bigint|number|string} organizationId
 * @param {number} userId
 * @returns {Promise<void>}
 */
export async function ensureTenantApplicantUserPermissions(organizationId, userId) {
  const orgIdBig =
    typeof organizationId === "bigint" ? organizationId : BigInt(String(organizationId));
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return;
  if (orgIdBig === 0n) return;

  const codes = [...TENANT_APPLICANT_CAPABILITY_CODES];
  const perms = await findActivePermissionsByCodes(codes);
  if (perms.length === 0) return;

  await grantUserPermissionsBulk(
    perms.map((p) => ({
      userId: uid,
      permissionId: p.permissionId,
      organizationId: orgIdBig,
    })),
  );
}
