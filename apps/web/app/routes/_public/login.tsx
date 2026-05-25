/**
 * @module login
 * @description Pantalla de login (boundary de autenticación PRE-SESIÓN).
 *
 * Patrón RR7: el formulario postea a la `action` de ESTA ruta (vía `useFetcher`),
 * NO a `apiRequest('/api/...')`. La action autentica server-side reutilizando el
 * use-case `authenticateUser` (slice identity) + el manejo de sesión server-side
 * (`~/platform/session/session.server`): setea la cookie httpOnly del JWT +
 * cookies legibles por JS (rol, nombre, etc.) y redirige a `/dashboard`.
 *
 * La orquestación completa (auth + permisos + cookies) vive en `dispatchUserApi`
 * (`loginHandler`); la reutilizamos aquí para evitar duplicar lógica y mantener
 * paridad 1:1 con el contrato legacy, transformando su Response 200 en un
 * `redirect` que conserva los `Set-Cookie`. En error, devolvemos los datos del
 * fallo (mensaje + code + organizations) a la UI.
 *
 * Legacy de referencia:
 *   - Frontend/src/components/LoginForm.tsx (redirect a /dashboard tras OK)
 *   - Backend/controllers/userController.js login (credenciales / ambiguo / inactivo)
 */
import { redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import LoginForm from "~/shared/ui/LoginForm";
import { readCookies } from "~/platform/session/session.server";
import { decodeRequestUser, extractRequestIp } from "~/platform/session/jwt.server";
import { dispatchUserApi } from "~/contexts/identity/interface/api/userApi.server";

export type LoginActionData = {
  error: string;
  code?: string;
  organizations?: Array<{ id: string; nombre: string }>;
};

export function meta() {
  return [
    { title: "Iniciar sesión — CocoConsulting" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = readCookies(request);
  if (token) {
    try {
      await decodeRequestUser(token, extractRequestIp(request));
      // Sesión válida: redirigir al dashboard.
      return redirect("/dashboard");
    } catch {
      // Token inválido/expirado: continuar al login.
    }
  }
  return null;
}

/**
 * Action de login. Reúne las credenciales del `<Form>` y delega en el handler
 * de autenticación server-side del slice identity. En éxito, redirige a
 * `/dashboard` propagando las cookies de sesión (httpOnly + legacy client). En
 * error, devuelve el mensaje y el code para que `LoginForm` los muestre.
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response | LoginActionData> {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const organizationId = String(form.get("organization_id") ?? "").trim();

  const payload: { username: string; password: string; organization_id?: string } = {
    username,
    password,
  };
  if (organizationId) payload.organization_id = organizationId;

  // Reutilizamos la orquestación completa (auth + permisos + set-cookie) del
  // dispatcher del slice identity, sin duplicar lógica.
  const internalReq = new Request("https://internal/api/user/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Conservamos los headers de IP para el binding JWT↔IP del legacy.
      ...forwardedIpHeaders(request),
    },
    body: JSON.stringify(payload),
  });

  const response = await dispatchUserApi({ request: internalReq, subpath: "login" });

  if (response.ok) {
    // Éxito: redirigir a /dashboard arrastrando los Set-Cookie de sesión.
    const headers = new Headers();
    for (const cookie of response.headers.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
    return redirect("/dashboard", { headers });
  }

  // Error: traducimos el body del API a datos para la UI (paridad legacy).
  const body = (await safeJson(response)) as
    | { message?: string; error?: string; code?: string; organizations?: Array<{ id: string; nombre: string }> }
    | null;

  const code = body?.error ?? body?.code;
  const message = body?.message ?? "Error al iniciar sesión";
  return {
    error: message,
    code,
    ...(Array.isArray(body?.organizations) ? { organizations: body.organizations } : {}),
  };
}

/** Reenvía los headers de IP del request original para el binding JWT↔IP. */
function forwardedIpHeaders(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const xff = request.headers.get("x-forwarded-for");
  if (xff) out["x-forwarded-for"] = xff;
  const real = request.headers.get("x-real-ip");
  if (real) out["x-real-ip"] = real;
  return out;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function LoginRoute() {
  return <LoginForm />;
}
