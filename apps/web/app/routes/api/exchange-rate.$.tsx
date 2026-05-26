/**
 * @module exchange-rate.$
 * @description Resource route /api/exchange-rate/*. Delega al dispatcher del
 * slice fx. Mantenido para compatibilidad con `ExchangeRateDisplay.tsx` y el
 * contrato OpenAPI documentado.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchExchangeRateApi } from "~/contexts/fx/interface/api/fxApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchExchangeRateApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchExchangeRateApi({ request, subpath: getSubpath(params) });
}
