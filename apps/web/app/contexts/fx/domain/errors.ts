/**
 * @module errors
 * @description Errores tipados del dominio del slice fx.
 */
export class FxError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "FxError";
  }
}

export class FxProviderUnavailableError extends FxError {
  constructor(message?: string) { super(message ?? "FxProviderUnavailableError", "FXPROVIDERUNAVAILABLE"); }
}

export class UnsupportedCurrencyError extends FxError {
  constructor(message?: string) { super(message ?? "UnsupportedCurrencyError", "UNSUPPORTEDCURRENCY"); }
}
