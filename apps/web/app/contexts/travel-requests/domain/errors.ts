/**
 * @module errors
 * @description Errores tipados del dominio. Los actions/loaders los mapean
 * a status HTTP via `jsonFromError`.
 */
export class TravelRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "TravelRequestError";
  }
}

export class RequestNotFoundError extends TravelRequestError {
  constructor(requestId: number) {
    super(`Travel request ${requestId} not found`, "REQUEST_NOT_FOUND", 404);
  }
}

export class InvalidStatusTransitionError extends TravelRequestError {
  constructor(currentStatus: string, requestedTransition: string) {
    super(
      `Cannot ${requestedTransition} a request in status "${currentStatus}"`,
      "INVALID_STATUS_TRANSITION",
      409,
    );
  }
}

export class RequestNotCancellableError extends TravelRequestError {
  constructor(currentStatus: string) {
    super(
      `Request in status "${currentStatus}" cannot be cancelled`,
      "REQUEST_NOT_CANCELLABLE",
      409,
    );
  }
}

export class DuplicateCfdiError extends TravelRequestError {
  constructor() {
    super(
      "Este CFDI (UUID) ya está registrado en el sistema.",
      "DUPLICATE_CFDI_UUID",
      409,
    );
  }
}
