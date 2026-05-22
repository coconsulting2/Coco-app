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
