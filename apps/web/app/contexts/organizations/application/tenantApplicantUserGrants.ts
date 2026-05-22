/**
 * @module tenantApplicantUserGrants
 * @description Persiste en `User_Permission` los códigos de la capacidad
 * solicitante del tenant. Idempotente (`skipDuplicates`).
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — shared config legacy (sin tipos)
import { TENANT_APPLICANT_CAPABILITY_CODES } from "@coco/shared-config/tenantApplicantCapability";
import {
  findActivePermissionsByCodes,
  grantUserPermissionsBulk,
} from "~/contexts/organizations/infrastructure/tenantApplicantGrantQueries.js";

export async function ensureTenantApplicantUserPermissions(
  organizationId: bigint | number | string,
  userId: number,
): Promise<void> {
  const orgIdBig =
    typeof organizationId === "bigint" ? organizationId : BigInt(String(organizationId));
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return;
  if (orgIdBig === 0n) return;

  const codes = [...(TENANT_APPLICANT_CAPABILITY_CODES as string[])];
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
