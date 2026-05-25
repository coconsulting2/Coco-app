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

export class InvalidDecisionError extends ReceiptsCfdiError {
  constructor(message?: string) {
    super(message ?? "Decisión inválida: solo se acepta 'approve' o 'reject'.", "INVALIDDECISION", 400);
  }
}

export class CommentRequiredError extends ReceiptsCfdiError {
  constructor(message?: string) {
    super(message ?? "El comentario es obligatorio al rechazar un comprobante.", "COMMENTREQUIRED", 400);
  }
}

export class ReceiptAlreadyDecidedError extends ReceiptsCfdiError {
  constructor(message?: string) {
    super(message ?? "Receipt already approved or rejected", "RECEIPTALREADYDECIDED", 409);
  }
}

export class ReceiptDeadlinePassedError extends ReceiptsCfdiError {
  constructor(message?: string) {
    super(
      message ?? "No se puede aprobar el comprobante: han pasado más de los días configurados desde el fin del viaje.",
      "RECEIPTDEADLINEPASSED",
      409,
    );
  }
}

export class ReceiptMissingCfdiError extends ReceiptsCfdiError {
  constructor(message?: string) {
    super(
      message ?? "No hay CFDI registrado para este comprobante. No se puede aprobar el reembolso.",
      "RECEIPTMISSINGCFDI",
      409,
    );
  }
}

export class SatRejectedError extends ReceiptsCfdiError {
  constructor(public readonly estado: string, message?: string) {
    super(
      message ?? `El SAT reporta el CFDI como '${estado}'. No se puede aprobar el reembolso.`,
      "SATREJECTED",
      409,
    );
  }
}

export class EfosBlacklistedError extends ReceiptsCfdiError {
  constructor(public readonly validacionEFOS: string, message?: string) {
    super(
      message ?? `El emisor del CFDI está en lista negra EFOS (código ${validacionEFOS}). No se puede aprobar.`,
      "EFOSBLACKLISTED",
      409,
    );
  }
}

export class ReceiptValidationPersistError extends ReceiptsCfdiError {
  constructor(message?: string) {
    super(message ?? "Failed to update receipt validation", "RECEIPTVALIDATIONPERSIST", 400);
  }
}
