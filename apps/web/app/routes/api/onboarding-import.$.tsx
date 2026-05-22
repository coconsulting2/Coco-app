/**
 * @module onboarding-import
 * @description Resource route /api/onboarding.import/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchOnboardingImportApi } from "~/contexts/onboarding/interface/api/onboarding-importApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchOnboardingImportApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchOnboardingImportApi({ request, subpath: getSubpath(params as any) });
}
