/**
 * @module logout
 * @description Resource route de logout (action-only). Limpia la sesión
 * server-side (cookie httpOnly del JWT + cookies legacy legibles por JS) y
 * redirige a `/login`.
 *
 * Patrón RR7: el componente `Logout` postea aquí vía `useFetcher`/`Form`,
 * NO a `apiRequest('/api/user/logout')`. Reutilizamos la orquestación de
 * `dispatchUserApi` (`logoutHandler`) para construir los Set-Cookie de
 * invalidación, manteniendo paridad 1:1 con el contrato legacy.
 *
 * Legacy de referencia: Backend/controllers/userController.js logout +
 * Frontend Logout (redirect a /login tras limpiar sesión).
 */
import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";

import { dispatchUserApi } from "~/contexts/identity/interface/api/userApi.server";

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  // El handler de logout del slice identity emite los Set-Cookie que invalidan
  // la sesión (httpOnly + legacy). El subpath es `logout` (método GET en el
  // dispatcher legacy).
  const internalReq = new Request("https://internal/api/user/logout", {
    method: "GET",
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  const response = await dispatchUserApi({ request: internalReq, subpath: "logout" });

  const headers = new Headers();
  for (const cookie of response.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }
  return redirect("/login", { headers });
}

// GET directo a /logout: limpia sesión igual que la action (idempotente).
export async function loader({ request }: ActionFunctionArgs): Promise<Response> {
  return action({ request } as ActionFunctionArgs);
}
