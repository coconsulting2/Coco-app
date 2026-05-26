/**
 * @module viaticos-policy.$
 * @description Resource route /api/viaticos-policy/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchViaticosPolicyApi } from "~/contexts/policies/interface/api/viaticos-policyApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchViaticosPolicyApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchViaticosPolicyApi({ request, subpath: getSubpath(params) });
}
