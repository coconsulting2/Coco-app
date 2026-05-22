/**
 * @module approverResolverGlobal
 * @description Adapter que inyecta el prisma client global al use-case puro
 * `resolveN1N2Approvers` (que ya recibe `db` por parámetro).
 */
import prisma from "~/platform/db/prisma.server.js";
import {
  resolveN1N2Approvers,
  type ResolvedApprovers,
} from "~/contexts/approvals/application/approverResolver.js";

export async function resolveN1N2ApproversGlobal(
  organizationId: bigint | null | undefined,
  departmentId: number | null | undefined,
  userId: number | null | undefined,
): Promise<ResolvedApprovers> {
  return resolveN1N2Approvers(
    prisma as unknown as Parameters<typeof resolveN1N2Approvers>[0],
    organizationId,
    departmentId,
    userId,
  );
}
