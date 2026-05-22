/**
 * @module errors
 * @description Errores tipados del dominio del slice travel-agency.
 */
export class TravelAgencyError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "TravelAgencyError";
  }
}

export class AttentionNotFoundError extends TravelAgencyError {
  constructor(message?: string) { super(message ?? "AttentionNotFoundError", "ATTENTIONNOTFOUND"); }
}

export class InvalidQuoteError extends TravelAgencyError {
  constructor(message?: string) { super(message ?? "InvalidQuoteError", "INVALIDQUOTE"); }
}
