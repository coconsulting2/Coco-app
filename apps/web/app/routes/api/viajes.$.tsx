/**
 * @module viajes.$
 * @description Resource route /api/viajes/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchViajesApi } from "~/contexts/travel-requests/interface/api/viajesApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchViajesApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchViajesApi({ request, subpath: getSubpath(params) });
}
