/**
 * @module errors
 * @description Errores tipados del dominio del slice onboarding.
 */
export class OnboardingError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "OnboardingError";
  }
}

export class ImportNotFoundError extends OnboardingError {
  constructor(message?: string) { super(message ?? "ImportNotFoundError", "IMPORTNOTFOUND"); }
}

export class InvalidImportPayloadError extends OnboardingError {
  constructor(message?: string) { super(message ?? "InvalidImportPayloadError", "INVALIDIMPORTPAYLOAD"); }
}

export class ImportRowError extends OnboardingError {
  constructor(message?: string) { super(message ?? "ImportRowError", "IMPORTROW"); }
}
