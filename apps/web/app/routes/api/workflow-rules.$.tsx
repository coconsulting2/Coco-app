/**
 * @module workflow-rules.$
 * @description Resource route /api/workflow-rules/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchWorkflowRulesApi } from "~/contexts/workflow/interface/api/workflow-rulesApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchWorkflowRulesApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchWorkflowRulesApi({ request, subpath: getSubpath(params) });
}
