/**
 * @module errors
 * @description Errores tipados del dominio del slice receipts-cfdi.
 */
export class ReceiptsCfdiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "ReceiptsCfdiError";
  }
}

export class ReceiptNotFoundError extends ReceiptsCfdiError {
  constructor(message?: string) { super(message ?? "ReceiptNotFoundError", "RECEIPTNOTFOUND"); }
}

export class CfdiAlreadyExistsError extends ReceiptsCfdiError {
  constructor(message?: string) { super(message ?? "CfdiAlreadyExistsError", "CFDIALREADYEXISTS"); }
}

export class InvalidCfdiXmlError extends ReceiptsCfdiError {
  constructor(message?: string) { super(message ?? "InvalidCfdiXmlError", "INVALIDCFDIXML"); }
}
