/**
 * @module errors
 * @description Errores tipados del dominio del slice organizations.
 */
export class OrganizationsError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "OrganizationsError";
  }
}

export class OrganizationNotFoundError extends OrganizationsError {
  constructor(message?: string) { super(message ?? "OrganizationNotFoundError", "ORGANIZATIONNOTFOUND"); }
}

export class OrganizationSuspendedError extends OrganizationsError {
  constructor(message?: string) { super(message ?? "OrganizationSuspendedError", "ORGANIZATIONSUSPENDED"); }
}

export class OnlyRootCanImpersonateError extends OrganizationsError {
  constructor(message?: string) { super(message ?? "OnlyRootCanImpersonateError", "ONLYROOTCANIMPERSONATE"); }
}
