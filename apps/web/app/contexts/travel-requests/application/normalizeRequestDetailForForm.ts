/**
 * @module normalizeRequestDetailForForm
 * @description Convierte el resultado de `getRequestDetail` (que devuelve
 * un array de filas denormalizadas — una por ruta, con campos de la
 * solicitud repetidos) al shape consumible por `TravelRequestForm`
 * (request fields en el top + `routes: RouteFormInput[]` anidado).
 *
 * Devuelve `null` si la solicitud no existe o no tiene rutas.
 */

export type RouteFormInput = {
  router_index: number;
  origin_country: string | null;
  origin_city: string | null;
  destination_country: string | null;
  destination_city: string | null;
  beginning_date: string | null;
  beginning_time: string | null;
  ending_date: string | null;
  ending_time: string | null;
  plane_needed: boolean;
  hotel_needed: boolean;
};

export type RequestDetailFormInput = {
  request_id: number;
  request_status_id: number | null;
  request_status: string | null;
  notes: string | null;
  requested_fee: number | string | null;
  imposed_fee: number | string | null;
  request_days: number | null;
  creation_date: string | null;
  last_mod_date: string | null;
  user_name: string | null;
  user_email: string | null;
  user_phone_number: string | null;
  selected_flight_offer: unknown;
  selected_hotel_offer: unknown;
  routes: RouteFormInput[];
};

type RawRow = {
  request_id?: unknown;
  request_status_id?: unknown;
  request_status?: unknown;
  notes?: unknown;
  requested_fee?: unknown;
  imposed_fee?: unknown;
  request_days?: unknown;
  creation_date?: unknown;
  last_mod_date?: unknown;
  user_name?: unknown;
  user_email?: unknown;
  user_phone_number?: unknown;
  selected_flight_offer?: unknown;
  selected_hotel_offer?: unknown;
  router_index?: unknown;
  origin_country?: unknown;
  origin_city?: unknown;
  destination_country?: unknown;
  destination_city?: unknown;
  beginning_date?: unknown;
  beginning_time?: unknown;
  ending_date?: unknown;
  ending_time?: unknown;
  plane_needed?: unknown;
  hotel_needed?: unknown;
};

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    const fn = (v as { toNumber: () => number }).toNumber;
    if (typeof fn === "function") return fn.call(v);
  }
  return null;
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true" || v === "1";
}

/**
 * View-model más rico para vistas tipo `detalles-solicitud` (incluye
 * datos del usuario y rutas con shape display). Se computa a partir del
 * mismo array crudo que `normalizeRequestDetailForForm`.
 */
export type RequestDetailDisplay = {
  request_id: number;
  request_status_id: number | null;
  request_status: string | null;
  notes: string | null;
  requested_fee: number;
  imposed_fee: number;
  request_days: number | null;
  creation_date: string | null;
  user: {
    user_name: string | null;
    user_email: string | null;
    user_phone_number: string | null;
  };
  routes: Array<{
    router_index: number;
    origin_country: string | null;
    origin_city: string | null;
    destination_country: string | null;
    destination_city: string | null;
    beginning_date: string | null;
    beginning_time: string | null;
    ending_date: string | null;
    ending_time: string | null;
    plane_needed: boolean;
    hotel_needed: boolean;
  }>;
};

export function normalizeRequestDetailForDisplay(raw: unknown): RequestDetailDisplay | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const head = raw[0] as RawRow;
  const requestId = toNum(head.request_id);
  if (requestId === null) return null;

  const routes = (raw as RawRow[])
    .filter((row) => row.router_index !== null && row.router_index !== undefined)
    .map((row, i) => ({
      router_index: toNum(row.router_index) ?? i,
      origin_country: toStr(row.origin_country),
      origin_city: toStr(row.origin_city),
      destination_country: toStr(row.destination_country),
      destination_city: toStr(row.destination_city),
      beginning_date: toStr(row.beginning_date),
      beginning_time: toStr(row.beginning_time),
      ending_date: toStr(row.ending_date),
      ending_time: toStr(row.ending_time),
      plane_needed: toBool(row.plane_needed),
      hotel_needed: toBool(row.hotel_needed),
    }));

  return {
    request_id: requestId,
    request_status_id: toNum(head.request_status_id),
    request_status: toStr(head.request_status),
    notes: toStr(head.notes),
    requested_fee: toNum(head.requested_fee) ?? 0,
    imposed_fee: toNum(head.imposed_fee) ?? 0,
    request_days: toNum(head.request_days),
    creation_date: toStr(head.creation_date),
    user: {
      user_name: toStr(head.user_name),
      user_email: toStr(head.user_email),
      user_phone_number: toStr(head.user_phone_number),
    },
    routes,
  };
}

export function normalizeRequestDetailForForm(raw: unknown): RequestDetailFormInput | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const head = raw[0] as RawRow;
  const requestId = toNum(head.request_id);
  if (requestId === null) return null;

  const routes: RouteFormInput[] = (raw as RawRow[])
    .filter((row) => row.router_index !== null && row.router_index !== undefined)
    .map((row, i) => ({
      router_index: toNum(row.router_index) ?? i,
      origin_country: toStr(row.origin_country),
      origin_city: toStr(row.origin_city),
      destination_country: toStr(row.destination_country),
      destination_city: toStr(row.destination_city),
      beginning_date: toStr(row.beginning_date),
      beginning_time: toStr(row.beginning_time),
      ending_date: toStr(row.ending_date),
      ending_time: toStr(row.ending_time),
      plane_needed: toBool(row.plane_needed),
      hotel_needed: toBool(row.hotel_needed),
    }));

  return {
    request_id: requestId,
    request_status_id: toNum(head.request_status_id),
    request_status: toStr(head.request_status),
    notes: toStr(head.notes),
    requested_fee: toNum(head.requested_fee) ?? toStr(head.requested_fee),
    imposed_fee: toNum(head.imposed_fee) ?? toStr(head.imposed_fee) ?? 0,
    request_days: toNum(head.request_days),
    creation_date: toStr(head.creation_date),
    last_mod_date: toStr(head.last_mod_date),
    user_name: toStr(head.user_name),
    user_email: toStr(head.user_email),
    user_phone_number: toStr(head.user_phone_number),
    selected_flight_offer: head.selected_flight_offer ?? null,
    selected_hotel_offer: head.selected_hotel_offer ?? null,
    routes,
  };
}
