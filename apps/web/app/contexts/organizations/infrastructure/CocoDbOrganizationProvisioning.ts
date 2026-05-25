/**
 * @module CocoDbOrganizationProvisioning
 * @description Adapter del puerto `OrganizationProvisioning` sobre los
 * seedHelpers de `@coco/db` (que reciben el PrismaClient). Boundary infra:
 * los helpers son JS sin tipos, por eso se tipan en el límite con un cast
 * controlado a las firmas declaradas localmente (boundary infra tolerable).
 */
import prisma from "~/platform/db/prisma.server.js";
import {
  bootstrapOrganizationCatalogs,
  ensureOrganizationAdmin,
} from "@coco/db";
import type {
  OrganizationProvisioning,
  ProvisionAdminInput,
} from "~/contexts/organizations/domain/ports/OrganizationProvisioning.js";

type BootstrapFn = (
  prisma: unknown,
  organizationId: bigint,
  opts?: { includeDittaSuperAdmin?: boolean },
) => Promise<unknown>;

type EnsureAdminFn = (
  prisma: unknown,
  organizationId: bigint,
  params: ProvisionAdminInput,
) => Promise<unknown>;

const bootstrap = bootstrapOrganizationCatalogs as unknown as BootstrapFn;
const ensureAdmin = ensureOrganizationAdmin as unknown as EnsureAdminFn;

export class CocoDbOrganizationProvisioning implements OrganizationProvisioning {
  async bootstrapCatalogs(
    organizationId: bigint,
    opts: { includeDittaSuperAdmin?: boolean } = {},
  ): Promise<void> {
    await bootstrap(prisma, organizationId, opts);
  }

  async ensureAdmin(
    organizationId: bigint,
    input: ProvisionAdminInput,
  ): Promise<void> {
    await ensureAdmin(prisma, organizationId, input);
  }
}
