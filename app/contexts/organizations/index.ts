/**
 * @module index
 * @description API pública del slice organizations.
 */

export type { Organization } from "~/contexts/organizations/domain/entities/Organization";
export type { OrganizationRepository } from "~/contexts/organizations/domain/ports/OrganizationRepository";
export { OrganizationsError, OrganizationNotFoundError, OrganizationSuspendedError, OnlyRootCanImpersonateError } from "~/contexts/organizations/domain/errors";

// @ts-ignore — JS module
export { listOrganizations, getOrganization, createOrganization, updateOrganization } from "~/contexts/organizations/application/organizationService.js";
// @ts-ignore — JS module
export { ensureTenantApplicantUserPermissions } from "~/contexts/organizations/application/tenantApplicantUserGrants.js";
