/**
 * @module approval-substitutes.$
 * @description Resource route /api/approval-substitutes/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchApprovalSubstitutesApi } from "~/contexts/approvals/interface/api/approval-substitutesApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchApprovalSubstitutesApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchApprovalSubstitutesApi({ request, subpath: getSubpath(params as any) });
}
