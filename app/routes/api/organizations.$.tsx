/**
 * @module organizations.$
 * @description Resource route /api/organizations/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchOrganizationsApi } from "~/contexts/organizations/interface/api/organizationsApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchOrganizationsApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchOrganizationsApi({ request, subpath: getSubpath(params as any) });
}
