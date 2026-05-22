/**
 * @module @coco/integrations/duffel/flights
 * @description Búsqueda y mapeo de ofertas de vuelos vía Duffel API.
 */
import type { CreateOfferRequestSlice } from "@duffel/api/types";
import { createDuffelClient } from "#/duffel/client.js";

export type FlightSearchParams = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
};

export type NormalizedFlightOffer = {
  id: string;
  rawOfferId: string;
  airlineName: string;
  airlineIata: string;
  departureAt: string;
  arrivalAt: string;
  durationLabel: string;
  stops: number;
  totalAmount: number;
  totalCurrency: string;
};

type DuffelSegment = {
  marketing_carrier?: { name?: string; iata_code?: string };
  departing_at?: string;
  arriving_at?: string;
};

type DuffelSlice = {
  segments?: DuffelSegment[];
};

type DuffelOffer = {
  id: string;
  slices?: DuffelSlice[];
  total_amount: string;
  total_currency?: string;
};

function formatDuration(isoStart: string | undefined, isoEnd: string | undefined): string {
  if (!isoStart || !isoEnd) return "—";
  const a = new Date(isoStart).getTime();
  const b = new Date(isoEnd).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return "—";
  const mins = Math.round((b - a) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function mapFlightOffer(offer: DuffelOffer): NormalizedFlightOffer {
  const slices = offer.slices ?? [];
  const firstSlice = slices[0];
  const segments = firstSlice?.segments ?? [];
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const marketing = firstSeg?.marketing_carrier;
  const airlineName = marketing?.name ?? "Airline";
  const airlineIata = marketing?.iata_code ?? "—";
  const stops = Math.max(0, segments.length - 1);

  return {
    id: offer.id,
    rawOfferId: offer.id,
    airlineName,
    airlineIata,
    departureAt: firstSeg?.departing_at ?? "",
    arrivalAt: lastSeg?.arriving_at ?? "",
    durationLabel: formatDuration(firstSeg?.departing_at, lastSeg?.arriving_at),
    stops,
    totalAmount: parseFloat(offer.total_amount),
    totalCurrency: offer.total_currency ?? "USD",
  };
}

export async function searchFlightOffers(
  params: FlightSearchParams,
): Promise<NormalizedFlightOffer[]> {
  const duffel = createDuffelClient();
  const origin = String(params.origin || "").toUpperCase();
  const destination = String(params.destination || "").toUpperCase();
  const departureDate = String(params.departureDate || "");
  const passengers = Math.max(1, Math.min(9, Number(params.passengers) || 1));
  const returnDate = params.returnDate ? String(params.returnDate) : "";

  const slices: CreateOfferRequestSlice[] = [
    { origin, destination, departure_date: departureDate } as CreateOfferRequestSlice,
  ];
  if (returnDate && returnDate > departureDate) {
    slices.push({
      origin: destination,
      destination: origin,
      departure_date: returnDate,
    } as CreateOfferRequestSlice);
  }

  const { data } = await duffel.offerRequests.create({
    return_offers: true,
    slices,
    passengers: Array.from({ length: passengers }, () => ({ type: "adult" as const })),
    cabin_class: "economy",
  });

  const offers = (data?.offers ?? []) as unknown as DuffelOffer[];
  return offers.slice(0, 20).map(mapFlightOffer);
}
