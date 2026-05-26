/**
 * @module AttendRequest
 * @description UI de Agencia para cotizar vuelos + hospedaje vía Duffel y
 * finalizar la atención. Usa `useFetcher` para POSTear al action del route
 * padre `atender-solicitud.$id.tsx`. Búsqueda y selección de ofertas, así
 * como la finalización, se hacen sin clientes HTTP a endpoints internos.
 */
import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import ModalWrapper from "~/shared/ui/ModalWrapper";
import Toast from "~/shared/ui/Toast";
import { showAppAlert } from "~/shared/utils/appAlert";

const IATA_SUGGESTIONS = [
  "MEX",
  "GDL",
  "MTY",
  "CUN",
  "TIJ",
  "LAX",
  "JFK",
  "MIA",
  "ORD",
  "LHR",
  "CDG",
  "MAD",
  "BOG",
  "LIM",
  "SCL",
];

export type NormalizedFlightOffer = {
  id: string;
  airlineName: string;
  airlineIata: string;
  departureAt: string;
  arrivalAt: string;
  durationLabel: string;
  stops: number;
  totalAmount: number;
  totalCurrency: string;
  rawOfferId?: string;
};

export type NormalizedHotelOffer = {
  id: string;
  hotelName: string;
  addressHint: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  totalCurrency: string;
  stars: number;
  provider?: string;
  searchResultId?: string;
  ratesFetched?: boolean;
  rates?: Array<{
    rateId: string;
    roomName?: string;
    rateName?: string;
    totalAmount: number;
    totalCurrency: string;
    boardType?: string;
  }>;
};

export type HotelSearchDefaults = {
  ciudad: string;
  fecha_entrada: string;
  fecha_salida: string;
  huespedes: number;
};

export type FlightSearchDefaults = {
  fecha: string;
  pasajeros: number;
};

interface Props {
  requestId: number;
  needsPlane?: boolean;
  needsHotel?: boolean;
  hotelDefaults?: HotelSearchDefaults | null;
  flightDefaults?: FlightSearchDefaults | null;
}

type FetcherData =
  | { ok: true; intent: "searchFlights"; offers: NormalizedFlightOffer[] }
  | { ok: true; intent: "searchHotels"; offers: NormalizedHotelOffer[] }
  | { ok: true; intent: "selectFlight" }
  | { ok: true; intent: "selectHotel"; saved: NormalizedHotelOffer }
  | { ok: true; intent: "fetchHotelRates"; offer: NormalizedHotelOffer }
  | { ok: false; intent: string; error: string };

export default function AttendRequest({
  requestId,
  needsPlane = true,
  needsHotel = false,
  hotelDefaults = null,
  flightDefaults = null,
}: Props) {
  const fetcher = useFetcher<FetcherData>();

  const [origen, setOrigen] = useState("MEX");
  const [destino, setDestino] = useState("CUN");
  const [fecha, setFecha] = useState(
    () => flightDefaults?.fecha ?? new Date().toISOString().slice(0, 10),
  );
  const [fechaRegreso, setFechaRegreso] = useState("");
  const [pasajeros, setPasajeros] = useState(() => flightDefaults?.pasajeros ?? 1);
  const [offers, setOffers] = useState<NormalizedFlightOffer[]>([]);
  const [selected, setSelected] = useState<NormalizedFlightOffer | null>(null);

  const [hotelCiudad, setHotelCiudad] = useState(() => hotelDefaults?.ciudad ?? "");
  const [hotelCheckIn, setHotelCheckIn] = useState(
    () => hotelDefaults?.fecha_entrada ?? new Date().toISOString().slice(0, 10),
  );
  const [hotelCheckOut, setHotelCheckOut] = useState(
    () => hotelDefaults?.fecha_salida ?? new Date().toISOString().slice(0, 10),
  );
  const [hotelHuespedes, setHotelHuespedes] = useState(() => hotelDefaults?.huespedes ?? 1);
  const [hotelOffers, setHotelOffers] = useState<NormalizedHotelOffer[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<NormalizedHotelOffer | null>(null);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Reacciona a la respuesta del action según el `intent` retornado.
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;
    if (!data.ok) {
      showAppAlert(data.error, { variant: "error" });
      return;
    }
    if (data.intent === "searchFlights") {
      setOffers(data.offers);
      if (!data.offers.length) {
        showAppAlert("No se encontraron vuelos para esos criterios.", { variant: "info" });
      }
      return;
    }
    if (data.intent === "searchHotels") {
      setHotelOffers(data.offers);
      if (!data.offers.length) {
        showAppAlert("No se encontraron opciones de hospedaje para esos criterios.", {
          variant: "info",
        });
      }
      return;
    }
    if (data.intent === "selectFlight") {
      setToast({ message: "Oferta de vuelo guardada en la solicitud.", type: "success" });
      return;
    }
    if (data.intent === "selectHotel") {
      setSelectedHotel(data.saved);
      setToast({ message: "Opción de hospedaje guardada en la solicitud.", type: "success" });
      return;
    }
    if (data.intent === "fetchHotelRates") {
      const enriched = data.offer;
      setHotelOffers((prev) =>
        prev.map((h) =>
          h.searchResultId === enriched.searchResultId || h.id === enriched.id ? enriched : h,
        ),
      );
      setSelectedHotel((prev) =>
        prev &&
        (prev.searchResultId === enriched.searchResultId || prev.id === enriched.id)
          ? enriched
          : prev,
      );
      const count = enriched.rates?.length ?? 0;
      setToast({
        message: count
          ? `Se resolvieron ${count} tarifa(s) para ${enriched.hotelName}.`
          : `Sin tarifas disponibles para ${enriched.hotelName}.`,
        type: "success",
      });
    }
  }, [fetcher.state, fetcher.data]);

  const submitting = fetcher.state !== "idle";

  function submit(formData: FormData) {
    fetcher.submit(formData, { method: "post" });
  }

  const origenList = useMemo(
    () => IATA_SUGGESTIONS.filter((c) => c.includes(origen.toUpperCase()) || origen.length < 2),
    [origen],
  );
  const destinoList = useMemo(
    () => IATA_SUGGESTIONS.filter((c) => c.includes(destino.toUpperCase()) || destino.length < 2),
    [destino],
  );

  const introText = useMemo(() => {
    if (needsPlane && needsHotel) {
      return "Busca y guarda la cotización de vuelo y de hospedaje que correspondan a la solicitud antes de finalizar la atención.";
    }
    if (needsHotel) {
      return "Busca y guarda la cotización de hospedaje antes de finalizar la atención.";
    }
    return "Busca y guarda la cotización de vuelo antes de finalizar la atención.";
  }, [needsPlane, needsHotel]);

  function buscarVuelos() {
    const fd = new FormData();
    fd.set("intent", "searchFlights");
    fd.set("origen", origen);
    fd.set("destino", destino);
    fd.set("fecha", fecha);
    if (fechaRegreso.trim()) fd.set("fechaRegreso", fechaRegreso.trim());
    fd.set("pasajeros", String(pasajeros));
    submit(fd);
  }

  function buscarHoteles() {
    const ciudad = hotelCiudad.trim();
    if (ciudad.length < 2) {
      showAppAlert("Indica la ciudad o zona de hospedaje (al menos 2 caracteres).", {
        variant: "warning",
      });
      return;
    }
    const fd = new FormData();
    fd.set("intent", "searchHotels");
    fd.set("ciudad", ciudad);
    fd.set("fechaEntrada", hotelCheckIn);
    fd.set("fechaSalida", hotelCheckOut);
    fd.set("huespedes", String(hotelHuespedes));
    submit(fd);
  }

  function seleccionarOferta(offer: NormalizedFlightOffer) {
    setSelected(offer);
    const fd = new FormData();
    fd.set("intent", "selectFlight");
    fd.set("offer", JSON.stringify(offer));
    submit(fd);
  }

  function seleccionarHotel(offer: NormalizedHotelOffer) {
    const fd = new FormData();
    fd.set("intent", "selectHotel");
    fd.set("offer", JSON.stringify(offer));
    submit(fd);
  }

  function verTarifas(offer: NormalizedHotelOffer) {
    const searchResultId = offer.searchResultId ?? offer.id;
    if (!searchResultId) {
      showAppAlert("Esta opción no tiene un identificador de búsqueda para resolver tarifas.", {
        variant: "warning",
      });
      return;
    }
    const fd = new FormData();
    fd.set("intent", "fetchHotelRates");
    fd.set("searchResultId", searchResultId);
    fd.set("offer", JSON.stringify(offer));
    submit(fd);
  }

  function finalizarAtencion() {
    if (needsPlane && !selected) {
      showAppAlert("Selecciona y guarda una oferta de vuelo antes de finalizar la atención.", {
        variant: "warning",
      });
      return;
    }
    if (needsHotel && !selectedHotel) {
      showAppAlert("Selecciona y guarda una opción de hospedaje antes de finalizar la atención.", {
        variant: "warning",
      });
      return;
    }
    const fd = new FormData();
    fd.set("intent", "finalize");
    submit(fd);
  }

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  const canFinalize =
    (!needsPlane || Boolean(selected)) && (!needsHotel || Boolean(selectedHotel)) && !submitting;

  return (
    <div className="w-full max-w-5xl space-y-8 p-6 bg-white rounded border border-gray-200">
      <h1 className="text-xl font-semibold text-gray-900">Agencia de viajes — Solicitud #{requestId}</h1>
      <p className="text-sm text-gray-600">{introText}</p>

      {needsPlane ? (
        <section className="rounded-lg border border-gray-200 p-4 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Buscar vuelos</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Origen (IATA)</label>
              <input
                list="iata-origen"
                value={origen}
                onChange={(e) => setOrigen(e.target.value.toUpperCase())}
                maxLength={3}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm uppercase"
              />
              <datalist id="iata-origen">
                {origenList.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destino (IATA)</label>
              <input
                list="iata-destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value.toUpperCase())}
                maxLength={3}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm uppercase"
              />
              <datalist id="iata-destino">
                {destinoList.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha ida</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha regreso</label>
              <input
                type="date"
                value={fechaRegreso}
                onChange={(e) => setFechaRegreso(e.target.value)}
                min={fecha}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                title="Opcional — ida y vuelta según la solicitud"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pasajeros</label>
              <input
                type="number"
                min={1}
                max={9}
                value={pasajeros}
                onChange={(e) => setPasajeros(Number(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={buscarVuelos}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting && fetcher.formData?.get("intent") === "searchFlights"
                ? "Buscando…"
                : "Buscar vuelos"}
            </button>
          </div>
        </section>
      ) : null}

      {needsPlane && offers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Resultados de vuelo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((o) => (
              <article
                key={o.id}
                className="border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col gap-2 bg-white"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{o.airlineName}</p>
                    <p className="text-xs text-gray-500">
                      {o.airlineIata} · {o.stops === 0 ? "Directo" : `${o.stops} escala(s)`}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {o.totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}{" "}
                    {o.totalCurrency}
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  Salida: {formatTime(o.departureAt)} → Llegada: {formatTime(o.arrivalAt)}
                </p>
                <p className="text-xs text-gray-500">Duración: {o.durationLabel}</p>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => seleccionarOferta(o)}
                  className="mt-1 w-full py-2 rounded-md border border-blue-600 text-blue-700 text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
                >
                  Seleccionar vuelo
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {needsPlane && selected ? (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900">
          Vuelo seleccionado: <strong>{selected.airlineName}</strong> por {selected.totalAmount}{" "}
          {selected.totalCurrency}
        </div>
      ) : null}

      {needsHotel ? (
        <section className="rounded-lg border border-gray-200 p-4 bg-amber-50/40">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Buscar hospedaje</h2>
          <p className="text-xs text-gray-600 mb-3">
            Ciudad o zona del destino (según la solicitud). Ajusta las fechas si la estancia es distinta.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad o zona</label>
              <input
                type="text"
                value={hotelCiudad}
                onChange={(e) => setHotelCiudad(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                placeholder="Ej. Cancún, Quintana Roo"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entrada</label>
              <input
                type="date"
                value={hotelCheckIn}
                onChange={(e) => setHotelCheckIn(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Salida</label>
              <input
                type="date"
                value={hotelCheckOut}
                onChange={(e) => setHotelCheckOut(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Huéspedes</label>
              <input
                type="number"
                min={1}
                max={9}
                value={hotelHuespedes}
                onChange={(e) => setHotelHuespedes(Number(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={buscarHoteles}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:bg-gray-400"
            >
              {submitting && fetcher.formData?.get("intent") === "searchHotels"
                ? "Buscando…"
                : "Buscar hospedaje"}
            </button>
          </div>
        </section>
      ) : null}

      {needsHotel && hotelOffers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Resultados de hospedaje</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotelOffers.map((h) => (
              <article
                key={h.id}
                className="border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col gap-2 bg-white"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{h.hotelName}</p>
                    <p className="text-xs text-gray-500">{h.addressHint}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {h.totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}{" "}
                    {h.totalCurrency}
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  {h.nights} noche(s) · Entrada {h.checkIn} → Salida {h.checkOut}
                </p>
                {h.stars > 0 ? (
                  <p className="text-xs text-gray-500">Valoración: {h.stars}★</p>
                ) : null}
                {h.ratesFetched && h.rates && h.rates.length > 0 ? (
                  <ul className="mt-1 space-y-1 border-t border-gray-100 pt-2">
                    {h.rates.map((rate) => (
                      <li
                        key={rate.rateId}
                        className="flex justify-between gap-2 text-xs text-gray-700"
                      >
                        <span>
                          {rate.roomName ?? rate.rateName ?? "Tarifa"}
                          {rate.boardType ? ` · ${rate.boardType}` : ""}
                        </span>
                        <span className="font-medium tabular-nums">
                          {rate.totalAmount.toLocaleString("es-MX", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          {rate.totalCurrency}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => verTarifas(h)}
                    className="w-full py-2 rounded-md border border-gray-400 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {submitting && fetcher.formData?.get("intent") === "fetchHotelRates"
                      ? "Cargando tarifas…"
                      : "Ver tarifas"}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => seleccionarHotel(h)}
                    className="w-full py-2 rounded-md border border-amber-800 text-amber-900 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
                  >
                    Seleccionar hospedaje
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {needsHotel && selectedHotel ? (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900">
          Hospedaje seleccionado: <strong>{selectedHotel.hotelName}</strong> por{" "}
          {selectedHotel.totalAmount} {selectedHotel.totalCurrency}
        </div>
      ) : null}

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <ModalWrapper
          title="¿Finalizar atención de la solicitud?"
          message="Se marcará la solicitud como atendida por agencia de viajes."
          button_type="primary"
          modal_type="success"
          onConfirm={finalizarAtencion}
          variant="filled"
          disabled={!canFinalize}
        >
          {submitting && fetcher.formData?.get("intent") === "finalize"
            ? "Procesando…"
            : "Finalizar atención"}
        </ModalWrapper>
      </div>

      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </div>
  );
}
