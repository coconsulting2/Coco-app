/**
 * @module index
 * @description API pública del slice hotels.
 */

export type { HotelQuote } from "~/contexts/hotels/domain/entities/HotelQuote";
export type { HotelProvider } from "~/contexts/hotels/domain/ports/HotelProvider";
export { HotelsError, HotelSearchError, HotelQuoteUnavailableError } from "~/contexts/hotels/domain/errors";

