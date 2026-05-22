/**
 * @module errors
 * @description Errores tipados del dominio del slice flights.
 */
export class FlightsError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number = 400) {
    super(message);
    this.name = "FlightsError";
  }
}

export class FlightSearchError extends FlightsError {
  constructor(message?: string) { super(message ?? "FlightSearchError", "FLIGHTSEARCH"); }
}

export class QuoteExpiredError extends FlightsError {
  constructor(message?: string) { super(message ?? "QuoteExpiredError", "QUOTEEXPIRED"); }
}
