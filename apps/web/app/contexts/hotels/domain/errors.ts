/**
 * @module errors
 * @description Errores tipados del dominio del slice hotels.
 */
export class HotelsError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "HotelsError";
  }
}

export class HotelSearchError extends HotelsError {
  constructor(message?: string) { super(message ?? "HotelSearchError", "HOTELSEARCH"); }
}

export class HotelQuoteUnavailableError extends HotelsError {
  constructor(message?: string) { super(message ?? "HotelQuoteUnavailableError", "HOTELQUOTEUNAVAILABLE"); }
}

/** Rango de fechas inválido (check-out no posterior a check-in). */
export class InvalidStayDatesError extends HotelsError {
  constructor(message?: string) {
    super(message ?? "fecha_salida debe ser posterior a fecha_entrada", "INVALID_STAY_DATES", 400);
  }
}

/** Duffel Stays no habilitado en la cuenta (HTTP 503 en el contrato legacy). */
export class StaysNotEnabledError extends HotelsError {
  constructor(message?: string) {
    super(
      message ??
        "Duffel Stays no está habilitado en esta cuenta. Contacta a Duffel o usa HOTEL_PROVIDER=mock.",
      "STAYS_NOT_ENABLED",
      503,
    );
  }
}
