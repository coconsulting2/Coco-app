/**
 * @module files
 * @description Resource route /api/files/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchFilesApi } from "~/contexts/receipts-cfdi/interface/api/filesApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchFilesApi({ request, subpath: getSubpath(params) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchFilesApi({ request, subpath: getSubpath(params) });
}
