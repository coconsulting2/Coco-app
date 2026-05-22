/**
 * @module organizations (slice public API)
 * @description Convertido a TS en sesión D — sin `@ts-ignore` aquí.
 * (`organizationService.ts` mantiene un único `@ts-ignore` local apuntando
 * a `~/prisma/seedHelpers/bootstrapOrganization.js` mientras ese seedHelper
 * permanece en .js.)
 */

export type { Organization } from "~/contexts/organizations/domain/entities/Organization.js";
export type { OrganizationRepository } from "~/contexts/organizations/domain/ports/OrganizationRepository.js";
export {
  OrganizationsError,
  OrganizationNotFoundError,
  OrganizationSuspendedError,
  OnlyRootCanImpersonateError,
} from "~/contexts/organizations/domain/errors.js";

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
  type SerializedOrganization,
  type CreateOrganizationInput,
  type CreateClientOrgOnlyInput,
  type ListOrganizationsOpts,
  type UpdateOrganizationPatch,
} from "~/contexts/organizations/application/organizationService.js";

export { ensureTenantApplicantUserPermissions } from "~/contexts/organizations/application/tenantApplicantUserGrants.js";
