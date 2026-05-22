/**
 * @module travel-agent.$
 * @description Resource route /api/travel-agent/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchTravelAgentApi } from "~/contexts/travel-agency/interface/api/travel-agentApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchTravelAgentApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchTravelAgentApi({ request, subpath: getSubpath(params as any) });
}
