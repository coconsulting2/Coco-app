/**
 * @module flights
 * @description Resource route /api/flights/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchFlightsApi } from "~/contexts/flights/interface/api/flightsApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchFlightsApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchFlightsApi({ request, subpath: getSubpath(params as any) });
}
