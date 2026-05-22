/**
 * @module refunds.$
 * @description Resource route /api/refunds/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchRefundsApi } from "~/contexts/refunds/interface/api/refundsApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchRefundsApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchRefundsApi({ request, subpath: getSubpath(params as any) });
}
