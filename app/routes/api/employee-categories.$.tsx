/**
 * @module employee-categories.$
 * @description Resource route /api/employee-categories/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchEmployeeCategoriesApi } from "~/contexts/policies/interface/api/employee-categoriesApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchEmployeeCategoriesApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchEmployeeCategoriesApi({ request, subpath: getSubpath(params as any) });
}
