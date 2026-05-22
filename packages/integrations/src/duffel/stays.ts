/**
 * @module @coco/integrations/duffel/stays
 * @description Cliente Duffel Stays v2 (hospedaje). Radio en km (1–100).
 * @see https://duffel.com/docs/api/v2/search/stays-search
 */

const DUFFEL_API = "https://api.duffel.com";
const DEFAULT_RADIUS_KM = Number(process.env.STAYS_SEARCH_RADIUS_KM) || 10;

type Coordinates = { latitude: number; longitude: number };

type CityHint = { keys: string[] } & Coordinates;

const CITY_HINTS: ReadonlyArray<CityHint> = [
  { keys: ["cdmx", "ciudad de mexico", "mexico city", "df", "cd mx"], latitude: 19.4326, longitude: -99.1332 },
  { keys: ["monterrey", "mty"], latitude: 25.6866, longitude: -100.3161 },
  { keys: ["guadalajara", "gdl"], latitude: 20.6597, longitude: -103.3496 },
  { keys: ["cancun", "cancún", "cun"], latitude: 21.1619, longitude: -86.8515 },
  { keys: ["merida", "mérida", "mid"], latitude: 20.9674, longitude: -89.5926 },
  { keys: ["puebla"], latitude: 19.0414, longitude: -98.2063 },
  { keys: ["queretaro", "querétaro", "qro"], latitude: 20.5888, longitude: -100.3899 },
  { keys: ["tijuana", "tij"], latitude: 32.5149, longitude: -117.0382 },
  { keys: ["los cabos", "cabo san lucas", "sjd"], latitude: 22.8905, longitude: -109.9167 },
];

export function resolveCityToCoordinates(ciudad: string): Coordinates {
  const raw = String(ciudad ?? "").trim();
  if (!raw) return { latitude: 19.4326, longitude: -99.1332 };
  const norm = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  for (const row of CITY_HINTS) {
    if (row.keys.some((k) => norm.includes(k))) {
      return { latitude: row.latitude, longitude: row.longitude };
    }
  }
  return { latitude: 19.4326, longitude: -99.1332 };
}

export function clampStaysSearchRadiusKm(km: number): number {
  const n = Number(km);
  if (!Number.isFinite(n)) return 10;
  return Math.min(100, Math.max(1, Math.round(n)));
}

export type StaysAccessDeniedError = Error & {
  status?: number;
  staysNotEnabled?: boolean;
};

function parseDuffelErrorBody(bodyText: string): string {
  if (!bodyText) return "";
  try {
    const json = JSON.parse(bodyText) as {
      errors?: Array<{ message?: string; title?: string }>;
      error?: string;
    };
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      return json.errors
        .map((e) => e?.message ?? e?.title ?? "")
        .filter(Boolean)
        .join("; ");
    }
    if (typeof json.error === "string") return json.error;
  } catch {
    /* texto plano */
  }
  return bodyText.trim().slice(0, 500);
}

function throwDuffelHttpError(res: Response, bodyText: string): never {
  const message = parseDuffelErrorBody(bodyText) || `Duffel Stays HTTP ${res.status}`;
  const err = new Error(message) as StaysAccessDeniedError;
  err.status = res.status;
  err.staysNotEnabled =
    res.status === 403 ||
    /not enabled/i.test(message) ||
    /contact sales/i.test(message);
  throw err;
}

function getDuffelToken(): string {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("DUFFEL_ACCESS_TOKEN is not configured");
  }
  return token;
}

async function duffelFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getDuffelToken();
  const res = await fetch(`${DUFFEL_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Duffel-Version": "v2",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throwDuffelHttpError(res, bodyText);
  }
  if (!bodyText) return {} as T;
  return JSON.parse(bodyText) as T;
}

export type StaysGuest = { type: "adult" | "child"; age?: number };

export type StaysSearchInput = {
  coordinates: Coordinates;
  radiusKm?: number;
  checkInDate: string;
  checkOutDate: string;
  rooms?: number;
  guests: StaysGuest[];
};

export type StaysSearchResponse = {
  data?: { results?: unknown[] };
};

export async function staysSearch(input: StaysSearchInput): Promise<StaysSearchResponse> {
  const radius = clampStaysSearchRadiusKm(input.radiusKm ?? 10);
  return duffelFetch<StaysSearchResponse>("/stays/search", {
    method: "POST",
    body: JSON.stringify({
      data: {
        location: {
          radius,
          geographic_coordinates: input.coordinates,
        },
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        rooms: input.rooms ?? 1,
        guests: input.guests,
      },
    }),
  });
}

export async function staysFetchAllRates(searchResultId: string): Promise<{ data?: unknown }> {
  const id = String(searchResultId || "").trim();
  if (!id) throw new Error("search_result_id requerido");
  return duffelFetch<{ data?: unknown }>(
    `/stays/search_results/${encodeURIComponent(id)}/actions/fetch_all_rates`,
    {
      method: "POST",
      body: JSON.stringify({ data: {} }),
    },
  );
}

export function isStaysAccessDeniedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as StaysAccessDeniedError;
  if (e.staysNotEnabled) return true;
  if (e.status === 403) return true;
  const msg = String(e.message ?? "");
  return /not enabled/i.test(msg) || /contact sales/i.test(msg);
}

export type NormalizedStayOffer = {
  id: string;
  rawOfferId: string;
  searchResultId: string;
  accommodationId: string | null;
  hotelName: string;
  addressHint: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  totalCurrency: string;
  stars: number;
  provider: "duffel_stays";
};

type StaysResult = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  cheapest_rate_total_amount?: string;
  cheapest_rate_currency?: string;
  accommodation?: {
    id?: string;
    name?: string;
    rating?: number;
    ratings?: Array<{ value?: number }>;
    location?: {
      address?: { line_one?: string; city_name?: string };
    };
    rooms?: Array<{
      name?: string;
      rates?: Array<{
        id: string;
        name?: string;
        total_amount?: string;
        total_currency?: string;
        board_type?: string;
      }>;
    }>;
  };
};

export function mapStaysResults(data: { results?: unknown[] } | undefined): NormalizedStayOffer[] {
  const results = (data?.results ?? []) as StaysResult[];
  return results.slice(0, 20).map((result) => {
    const acc = result.accommodation;
    const addr = acc?.location?.address;
    const hint =
      [addr?.line_one, addr?.city_name].filter(Boolean).join(" · ") ||
      addr?.city_name ||
      "";
    const ms = new Date(result.check_out_date).getTime() - new Date(result.check_in_date).getTime();
    const nights = Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.round(ms / 86400000)) : 1;
    const star = typeof acc?.rating === "number" ? acc.rating : acc?.ratings?.[0]?.value ?? 0;

    return {
      id: result.id,
      rawOfferId: result.id,
      searchResultId: result.id,
      accommodationId: acc?.id ?? null,
      hotelName: acc?.name ?? "Hospedaje",
      addressHint: hint,
      checkIn: result.check_in_date,
      checkOut: result.check_out_date,
      nights,
      totalAmount: parseFloat(String(result.cheapest_rate_total_amount ?? "0")),
      totalCurrency: result.cheapest_rate_currency ?? "MXN",
      stars: typeof star === "number" ? star : 0,
      provider: "duffel_stays",
    };
  });
}

export type EnrichedRate = {
  rateId: string;
  roomName: string | undefined;
  rateName: string | undefined;
  totalAmount: number;
  totalCurrency: string;
  boardType: string | undefined;
};

export type EnrichedStayOffer = NormalizedStayOffer & {
  rates: EnrichedRate[];
  ratesFetched: true;
};

export function enrichOfferFromFetchAllRates(
  searchResult: StaysResult | undefined,
  baseOffer: NormalizedStayOffer,
): EnrichedStayOffer {
  const acc = searchResult?.accommodation ?? {};
  const rooms = acc.rooms ?? [];
  const rates: EnrichedRate[] = rooms.flatMap((room) =>
    (room.rates ?? []).map((rate) => ({
      rateId: rate.id,
      roomName: room.name,
      rateName: rate.name,
      totalAmount: parseFloat(String(rate.total_amount ?? "0")),
      totalCurrency: rate.total_currency ?? baseOffer.totalCurrency,
      boardType: rate.board_type,
    })),
  );
  const cheapest = rates.length
    ? rates.reduce((a, b) => (a.totalAmount <= b.totalAmount ? a : b))
    : null;

  return {
    ...baseOffer,
    hotelName: acc.name ?? baseOffer.hotelName,
    addressHint:
      [acc.location?.address?.line_one, acc.location?.address?.city_name]
        .filter(Boolean)
        .join(" · ") || baseOffer.addressHint,
    totalAmount: cheapest?.totalAmount ?? baseOffer.totalAmount,
    totalCurrency: cheapest?.totalCurrency ?? baseOffer.totalCurrency,
    stars: typeof acc.rating === "number" ? acc.rating : baseOffer.stars,
    rates,
    ratesFetched: true,
  };
}

export type StaySearchInputApp = {
  ciudad: string;
  fechaEntrada: string;
  fechaSalida: string;
  huespedes: number;
};

/** Atajo de alto nivel — equivalente al DuffelStaysProvider del legacy. */
export async function searchStays(input: StaySearchInputApp): Promise<NormalizedStayOffer[]> {
  const coordinates = resolveCityToCoordinates(input.ciudad);
  const adults = Math.max(1, Math.min(9, Number(input.huespedes) || 1));
  const guests: StaysGuest[] = Array.from({ length: adults }, () => ({ type: "adult" }));
  const response = await staysSearch({
    coordinates,
    radiusKm: DEFAULT_RADIUS_KM,
    checkInDate: input.fechaEntrada,
    checkOutDate: input.fechaSalida,
    rooms: 1,
    guests,
  });
  return mapStaysResults(response.data);
}
