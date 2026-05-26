/**
 * @module keys.$
 * @description Resource route /api/keys/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchKeysApi } from "~/contexts/api-keys/interface/api/keysApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchKeysApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchKeysApi({ request, subpath: getSubpath(params) });
}
