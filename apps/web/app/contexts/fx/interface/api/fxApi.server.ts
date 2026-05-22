/**
 * @module fxApi.server
 * @description Dispatcher para los endpoints públicos del slice fx.
 *
 * Mantenemos los `/api/*` SOLO porque:
 *   - Componentes legacy (`ExchangeRateDisplay.tsx`) los consumen vía apiClient.
 *   - Integraciones externas listas en OpenAPI (`swagger-m1.yaml`).
 *
 * Para flujos in-app nuevos, importa los services directamente desde
 * `~/contexts/fx/application/*` y úsalos en loaders/actions (DI).
 *
 * Endpoints:
 *   GET  /api/exchange-rate/rate?source=&target=
 *   POST /api/exchange-rate/convert      { amount, source, target }
 *   GET  /api/exchange-rate/currencies
 *   GET  /api/exchange-rate/history?source=&target=&startDate=&endDate=
 *   GET  /api/fx/convert?from=&to=&amount=
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requireSession } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  getExchangeRate,
  convertCurrency,
  getSupportedCurrencies,
  getRateHistory,
  convertAmount,
} from "~/contexts/fx";

type DispatchArgs = { request: Request; subpath: string };

const CURRENCY_RE = /^[A-Za-z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function dispatchExchangeRateApi({ request, subpath }: DispatchArgs): Promise<Response> {
  await requireSession(request);
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0]!;
  const url = new URL(request.url);

  try {
    if (method === "GET" && path === "rate") {
      const source = (url.searchParams.get("source") ?? "USD").toUpperCase();
      const target = (url.searchParams.get("target") ?? "MXN").toUpperCase();
      if (!CURRENCY_RE.test(source) || !CURRENCY_RE.test(target)) {
        return jsonError(400, "Currency codes must be 3 letters", "INVALID_CURRENCY");
      }
      const rateData = await getExchangeRate(source, target);
      return jsonOk({
        success: true,
        data: rateData,
        message: `Exchange rate from ${source} to ${target} retrieved successfully`,
      });
    }

    if (method === "POST" && path === "convert") {
      await assertCsrf(request);
      const body = (await readJson(request)) ?? {};
      const amount = Number(body.amount);
      const source = String(body.source ?? "USD").toUpperCase();
      const target = String(body.target ?? "MXN").toUpperCase();
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonError(400, "Amount must be a positive number", "INVALID_AMOUNT");
      }
      if (!CURRENCY_RE.test(source) || !CURRENCY_RE.test(target)) {
        return jsonError(400, "Currency codes must be 3 letters", "INVALID_CURRENCY");
      }
      const result = await convertCurrency(amount, source, target);
      return jsonOk({
        success: true,
        data: result,
        message: `Currency conversion from ${source} to ${target} completed successfully`,
      });
    }

    if (method === "GET" && path === "currencies") {
      const currencies = await getSupportedCurrencies();
      return jsonOk({
        success: true,
        data: currencies,
        message: "Supported currencies retrieved successfully",
      });
    }

    if (method === "GET" && path === "history") {
      const source = (url.searchParams.get("source") ?? "USD").toUpperCase();
      const target = (url.searchParams.get("target") ?? "MXN").toUpperCase();
      const startDate = url.searchParams.get("startDate") ?? "";
      const endDate = url.searchParams.get("endDate") ?? "";
      if (!CURRENCY_RE.test(source) || !CURRENCY_RE.test(target)) {
        return jsonError(400, "Currency codes must be 3 letters", "INVALID_CURRENCY");
      }
      if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
        return jsonError(400, "Dates must be YYYY-MM-DD", "INVALID_DATE");
      }
      const history = await getRateHistory(source, target, startDate, endDate);
      return jsonOk({
        success: true,
        data: history,
        message: `Rate history from ${source} to ${target} retrieved successfully`,
      });
    }

    return jsonError(404, `Unknown exchange-rate endpoint: ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function dispatchFxApi({ request, subpath }: DispatchArgs): Promise<Response> {
  await requireSession(request);
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0]!;
  const url = new URL(request.url);

  try {
    if (method === "GET" && path === "convert") {
      const from = (url.searchParams.get("from") ?? "").toUpperCase();
      const to = (url.searchParams.get("to") ?? "").toUpperCase();
      const amount = Number(url.searchParams.get("amount") ?? "0");
      if (!CURRENCY_RE.test(from) || !CURRENCY_RE.test(to)) {
        return jsonError(400, "Currency codes must be 3 letters", "INVALID_CURRENCY");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonError(400, "Amount must be positive", "INVALID_AMOUNT");
      }
      const data = await convertAmount(from, to, amount);
      return jsonOk({ success: true, data });
    }
    return jsonError(404, `Unknown fx endpoint: ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}

async function readJson(request: Request): Promise<any | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
