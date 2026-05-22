/**
 * @module index
 * @description API pública del slice flights.
 */

export type { FlightQuote } from "~/contexts/flights/domain/entities/FlightQuote";
export type { FlightProvider } from "~/contexts/flights/domain/ports/FlightProvider";
export { FlightsError, FlightSearchError, QuoteExpiredError } from "~/contexts/flights/domain/errors";

