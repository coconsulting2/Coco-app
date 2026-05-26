/**
 * @module CocoDbOrganizationProvisioning
 * @description Adapter del puerto `OrganizationProvisioning` sobre los
 * seedHelpers tipados de `@coco/db` (que reciben el PrismaClient). Los helpers
 * ya están tipados (TS), así que se invocan directamente sin casts de boundary.
 *
 * Usa `prismaBase` (cliente sin tenant-extension): el bootstrap escribe catálogos
 * cross-tenant con `organizationId` EXPLÍCITO en cada operación, así que el scoping
 * por tenant-extension no aplica (e incluso interferiría). RLS a nivel DB sigue vigente.
 */
import { prismaBase } from "@coco/db";
import {
  bootstrapOrganizationCatalogs,
  ensureOrganizationAdmin,
} from "@coco/db";
import type {
  OrganizationProvisioning,
  ProvisionAdminInput,
} from "~/contexts/organizations/domain/ports/OrganizationProvisioning.js";

export class CocoDbOrganizationProvisioning implements OrganizationProvisioning {
  async bootstrapCatalogs(
    organizationId: bigint,
    opts: { includeDittaSuperAdmin?: boolean } = {},
  ): Promise<void> {
    await bootstrapOrganizationCatalogs(prismaBase, organizationId, opts);
  }

  async ensureAdmin(
    organizationId: bigint,
    input: ProvisionAdminInput,
  ): Promise<void> {
    await ensureOrganizationAdmin(prismaBase, organizationId, input);
  }
}
