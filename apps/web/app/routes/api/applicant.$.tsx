/**
 * @module applicant.$
 * @description Resource route /api/applicant/* — delega al slice travel-requests.
 * Conservado para `TravelRequestForm.tsx` legacy. Para flujos nuevos in-app
 * usar actions/loaders directos (DI).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchApplicantApi } from "~/contexts/travel-requests/interface/api/applicantApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchApplicantApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchApplicantApi({ request, subpath: getSubpath(params) });
}
