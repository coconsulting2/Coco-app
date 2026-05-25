/**
 * @module OrganizationProvisioning
 * @description Puerto para el aprovisionamiento de una organización recién
 * creada: bootstrap de catálogos default y alta del admin inicial. El adapter
 * concreto (infrastructure) envuelve los seedHelpers de `@coco/db` que tocan
 * Prisma directamente. Los use-cases dependen SOLO de este contrato.
 */

export type ProvisionAdminInput = {
  userName: string;
  email: string;
  password: string;
  roleName?: string;
};

export interface OrganizationProvisioning {
  /** Bootstrappa catálogos default (roles, permisos, receipt types, ...). */
  bootstrapCatalogs(
    organizationId: bigint,
    opts?: { includeDittaSuperAdmin?: boolean },
  ): Promise<void>;
  /** Crea (idempotente) el usuario admin inicial de la organización. */
  ensureAdmin(
    organizationId: bigint,
    input: ProvisionAdminInput,
  ): Promise<void>;
}
