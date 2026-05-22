/**
 * @module authorizer.$
 * @description Resource route /api/authorizer/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchAuthorizerApi } from "~/contexts/approvals/interface/api/authorizerApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchAuthorizerApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchAuthorizerApi({ request, subpath: getSubpath(params as any) });
}
