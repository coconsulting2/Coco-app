/**
 * @module comprobantes.$
 * @description Resource route /api/comprobantes/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchComprobantesApi } from "~/contexts/receipts-cfdi/interface/api/comprobantesApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchComprobantesApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchComprobantesApi({ request, subpath: getSubpath(params) });
}
