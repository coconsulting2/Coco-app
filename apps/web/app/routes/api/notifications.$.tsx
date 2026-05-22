/**
 * @module notifications.$
 * @description Resource route /api/notifications/*. Delega al dispatcher del slice.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { dispatchNotificationsApi } from "~/contexts/notifications/interface/api/notificationsApi.server";

function getSubpath(params: { "*"?: string }): string {
  return params["*"] ?? "";
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return dispatchNotificationsApi({ request, subpath: getSubpath(params as any) });
}

export async function action({ request, params }: ActionFunctionArgs) {
  return dispatchNotificationsApi({ request, subpath: getSubpath(params as any) });
}
