/**
 * @module admin/onboarding-import
 * @description Importación masiva de usuarios (CSV/JSON).
 *
 * Loader: pide permiso `user:create` y expone si el actor puede crear orgs
 * nuevas (`organization:create`).
 *
 * Action (discriminado por `intent`):
 *   - "preview": multipart con `file` → parsea/valida vía use-case hex, sin persistir.
 *   - "apply":   JSON-en-campos → persiste usuarios (mutación crítica → runInRls).
 *
 * Toda data interna pasa por el use-case `preview/applyOnboardingImport` del slice
 * (DI + ports + adapters). El componente es prop-driven y dispara via useFetcher.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { requirePermissions, runInRls } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";
import {
  previewOnboardingImport,
  applyOnboardingImport,
  type ApplyImportOptions,
  type ApplyImportResult,
  type CustomImportRoleSpec,
  type PreviewImportResult,
} from "~/contexts/onboarding/index.js";
import OnboardingImportAdmin from "~/shared/ui/admin/OnboardingImportAdmin";

export function meta() {
  return [{ title: "Importar usuarios — CocoConsulting" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requirePermissions(request, "user:create");
  return {
    canCreateOrganization: Boolean(session.user.permissionSet?.has("organization:create")),
  };
}

export type OnboardingImportActionResult =
  | { ok: true; intent: "preview"; preview: PreviewImportResult }
  | { ok: true; intent: "apply"; result: ApplyImportResult }
  | { ok: false; intent: string; error: string };

/** Lee un objeto JSON opcional desde un campo de FormData. */
function readJsonField<T>(formData: FormData, field: string): T | undefined {
  const raw = formData.get(field);
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as T;
  } catch {
    /* ignore: campo malformado se trata como ausente */
  }
  return undefined;
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const session = await requirePermissions(request, "user:create");
  await assertCsrf(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const actorHasOrganizationCreate = Boolean(session.user.permissionSet?.has("organization:create"));

  try {
    if (intent === "preview") {
      const createNewOrganization = String(formData.get("createNewOrganization") ?? "") === "true";
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return jsonResult(
          { ok: false, intent, error: "Se requiere un archivo (campo: file)." },
          400,
        );
      }
      if (createNewOrganization && !actorHasOrganizationCreate) {
        return jsonResult(
          { ok: false, intent, error: "No tienes permiso para crear una organización nueva." },
          403,
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      // Para crear org nueva, el token se liga a la org del JWT (root), no a la impersonada.
      const organizationId =
        createNewOrganization && session.isRoot && session.jwtOrgId !== null
          ? session.jwtOrgId
          : session.organizationId;

      const preview = await runInRls(session, async () =>
        previewOnboardingImport({
          buffer,
          mimetype: file.type || "application/octet-stream",
          originalname: file.name,
          organizationId,
          actingUserId: session.user.user_id,
          options: { createNewOrganization, actorHasOrganizationCreate },
        }),
      );
      return jsonResult({ ok: true, intent: "preview", preview });
    }

    if (intent === "apply") {
      const previewToken = String(formData.get("previewToken") ?? "");
      if (!previewToken) {
        return jsonResult({ ok: false, intent, error: "Se requiere el campo previewToken." }, 400);
      }
      const createNewOrganization = String(formData.get("createNewOrganization") ?? "") === "true";
      if (createNewOrganization && !actorHasOrganizationCreate) {
        return jsonResult(
          { ok: false, intent, error: "No tienes permiso para crear una organización nueva." },
          403,
        );
      }

      const options: ApplyImportOptions = {
        roleMappings: readJsonField<Record<string, string>>(formData, "roleMappings"),
        roleOverrides: readJsonField<Record<string, string>>(formData, "roleOverrides"),
        permissionExtras: readJsonField<Record<string, string[]>>(formData, "permissionExtras"),
        passwordOverrides: readJsonField<Record<string, string>>(formData, "passwordOverrides"),
        customImportRoles: readJsonField<Record<string, CustomImportRoleSpec>>(
          formData,
          "customImportRoles",
        ),
        passwordGlobal:
          typeof formData.get("passwordGlobal") === "string"
            ? String(formData.get("passwordGlobal")).trim() || undefined
            : undefined,
        createNewOrganization,
      };

      const organizationId =
        createNewOrganization && session.isRoot && session.jwtOrgId !== null
          ? session.jwtOrgId
          : session.organizationId;

      const result = await runInRls(session, async () =>
        applyOnboardingImport({
          previewToken,
          organizationId,
          actingUserId: session.user.user_id,
          options,
        }),
      );
      return jsonResult({ ok: true, intent: "apply", result }, 201);
    }

    return jsonResult({ ok: false, intent, error: `Intent desconocido: ${intent}` }, 400);
  } catch (err) {
    const error = err instanceof Error ? err.message : "No se pudo procesar la importación.";
    return jsonResult({ ok: false, intent, error }, 422);
  }
}

function jsonResult(body: OnboardingImportActionResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default function PageRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <p className="eyebrow text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
          Coco / Admin / Importar
        </p>
        <h1 className="font-serif text-3xl md:text-4xl">Importar usuarios</h1>
      </header>
      <OnboardingImportAdmin canCreateOrganization={data.canCreateOrganization} />
    </section>
  );
}
