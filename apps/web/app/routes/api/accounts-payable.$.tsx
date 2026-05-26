/**
 * @module accounts-payable
 * @description Resource route /api/accounts-payable/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchAccountsPayableApi } from "~/contexts/accounts-payable/interface/api/accounts-payableApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchAccountsPayableApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchAccountsPayableApi({ request, subpath: getSubpath(params) });
}
