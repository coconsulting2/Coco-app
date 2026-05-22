/**
 * @module index
 * @description Redirige raíz → /login.
 */
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function loader(_args: LoaderFunctionArgs) {
  return redirect("/login");
}

export default function IndexRoute() {
  return null;
}
