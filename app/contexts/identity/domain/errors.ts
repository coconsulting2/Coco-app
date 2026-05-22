/**
 * @module errors
 * @description Errores de dominio del slice identity. Independientes de HTTP
 * (los adapters de interface mapean a Response status codes). Lanzar estos
 * desde use-cases; los actions/loaders los traducen a JSON estructurado.
 */
export class IdentityError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "IdentityError";
  }
}

export class InvalidCredentialsError extends IdentityError {
  constructor() { super("Invalid username or password", "INVALID_CREDENTIALS"); }
}

export class UserInactiveError extends IdentityError {
  constructor() { super("User account is inactive", "USER_INACTIVE"); }
}

export class OrganizationSuspendedError extends IdentityError {
  constructor() { super("Organización suspendida; contacta a tu administrador.", "ORG_SUSPENDED"); }
}

export class EmailAlreadyUsedError extends IdentityError {
  constructor() { super("Email already in use by another user", "EMAIL_DUPLICATE"); }
}

export class UserNotFoundError extends IdentityError {
  constructor(userId: number) { super(`User ${userId} not found`, "USER_NOT_FOUND"); }
}

export class AmbiguousUsernameError extends IdentityError {
  constructor(public readonly organizations: Array<{ id: string; nombre: string }>) {
    super("Username exists in multiple organizations", "AMBIGUOUS_USERNAME");
  }
}
