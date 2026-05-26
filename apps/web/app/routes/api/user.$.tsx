/**
 * @module user.$
 * @description Resource route que recibe TODO /api/user/* y lo delega al
 * dispatcher del slice identity. NO exporta default — RRv7 lo trata como API.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchUserApi } from "~/contexts/identity/interface/api/userApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchUserApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchUserApi({ request, subpath: getSubpath(params) });
}
