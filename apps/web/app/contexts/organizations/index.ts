/**
 * @module organizations (slice public API + composition root)
 * @description Fachada estable del slice organizations. Convertido a TS proper
 * en sesión LANE-ORG: sin supresores de tipos. La persistencia y el
 * bootstrap viven detrás de los puertos `OrganizationRepository` /
 * `OrganizationProvisioning`, con adapters Prisma en `infrastructure/`. Los
 * use-cases de `application/organizationService.ts` reciben deps por DI (default
 * = adapters concretos) para que rutas/loaders los consuman sin Prisma y los
 * tests inyecten stubs.
 */

export type { Organization } from "~/contexts/organizations/domain/entities/Organization.js";
export type {
  OrganizationRepository,
  OrganizationRecord,
  CreateOrganizationData,
  UpdateOrganizationData,
  ListOrganizationsWhere,
  ListOrganizationsPaging,
  ListOrganizationsResult,
} from "~/contexts/organizations/domain/ports/OrganizationRepository.js";
export type {
  OrganizationProvisioning,
  ProvisionAdminInput,
} from "~/contexts/organizations/domain/ports/OrganizationProvisioning.js";
export {
  OrganizationsError,
  OrganizationNotFoundError,
  OrganizationSuspendedError,
  OnlyRootCanImpersonateError,
} from "~/contexts/organizations/domain/errors.js";

export { PrismaOrganizationRepository } from "~/contexts/organizations/infrastructure/PrismaOrganizationRepository.js";
export { CocoDbOrganizationProvisioning } from "~/contexts/organizations/infrastructure/CocoDbOrganizationProvisioning.js";

export {
  listOrganizations,
  getOrganization,
  getOrganizationMe,
  createOrganization,
  createClientOrganizationOnly,
  updateOrganization,
  activateOrganization,
  suspendOrganization,
  OrganizationValidationError,
  type OrganizationServiceDeps,
  type SerializedOrganization,
  type CreateOrganizationInput,
  type CreateClientOrgOnlyInput,
  type ListOrganizationsOpts,
  type UpdateOrganizationPatch,
} from "~/contexts/organizations/application/organizationService.js";

export { ensureTenantApplicantUserPermissions } from "~/contexts/organizations/application/tenantApplicantUserGrants.js";
