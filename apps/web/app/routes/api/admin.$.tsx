/**
 * @module admin
 * @description Resource route /api/admin/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchAdminApi } from "~/contexts/identity/interface/api/adminApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchAdminApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchAdminApi({ request, subpath: getSubpath(params as any) });
}
