/**
 * @module policies.$
 * @description Resource route /api/policies/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchPoliciesApi } from "~/contexts/policies/interface/api/policiesApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchPoliciesApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchPoliciesApi({ request, subpath: getSubpath(params as any) });
}
