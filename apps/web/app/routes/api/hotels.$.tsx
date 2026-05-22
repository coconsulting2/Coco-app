/**
 * @module hotels
 * @description Resource route /api/hotels/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchHotelsApi } from "~/contexts/hotels/interface/api/hotelsApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchHotelsApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchHotelsApi({ request, subpath: getSubpath(params as any) });
}
