/**
 * @module login
 * @description Pantalla de login. Si el usuario ya tiene cookie de sesión
 * válida, redirige a /dashboard. Renderiza el componente LoginForm que
 * llama POST /api/user/login (resource route del slice identity).
 *
 * El componente LoginForm es exactamente el de Frontend/src/components/LoginForm.tsx —
 * copiado verbatim. Solo cambian los path aliases (resueltos vía tsconfig).
 */
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import LoginForm from "~/shared/ui/LoginForm";
import { readCookies } from "~/platform/session/session.server";
import { decodeRequestUser, extractRequestIp } from "~/platform/session/jwt.server";

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

export default function LoginRoute() {
  return <LoginForm />;
}
