/**
 * @module fx.$
 * @description Resource route /api/fx/*. Delega al slice fx.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchFxApi } from "~/contexts/fx/interface/api/fxApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchFxApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchFxApi({ request, subpath: getSubpath(params) });
}
