/**
 * @module errors
 * @description Errores tipados del dominio del slice accounts-payable.
 */
export class AccountsPayableError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "AccountsPayableError";
  }
}

export class PolizaNotFoundError extends AccountsPayableError {
  constructor(message?: string) { super(message ?? "PolizaNotFoundError", "POLIZANOTFOUND"); }
}

export class PolizaAlreadyExportedError extends AccountsPayableError {
  constructor(message?: string) { super(message ?? "PolizaAlreadyExportedError", "POLIZAALREADYEXPORTED"); }
}

export class InvalidAccountingDataError extends AccountsPayableError {
  constructor(message?: string) { super(message ?? "InvalidAccountingDataError", "INVALIDACCOUNTINGDATA"); }
}
