/**
 * @file app/contexts/__slice__/interface/api/myApi.server.ts
 * Dispatcher para resource routes. SOLO crear si hay razón externa:
 *   - Componente legacy lo consume via apiClient.
 *   - Integración de terceros.
 *   - OpenAPI contract documentado.
 *
 * Para flujos in-app, prefiere actions/loaders en `routes/` que llaman al
 * use-case por DI — elimina el doble-hop HTTP.
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";
import { requirePermissions, runInTenant } from "~/platform/session/requireUser.server";
import { assertCsrf } from "~/platform/csrf/csrf.server";

import { PrismaMyRepository } from "~/contexts/__slice__/infrastructure/PrismaMyRepository.server";
import { getMyEntity } from "~/contexts/__slice__/application/myUseCase";

type DispatchArgs = { request: Request; subpath: string };

export async function dispatch__Slice__Api({ request, subpath }: DispatchArgs): Promise<Response> {
  const session = await requirePermissions(request, "__slice__:read");
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0]!;

  try {
    if (method === "GET" && path.startsWith("by-id/")) {
      const id = Number(path.slice("by-id/".length));
      const entity = await runInTenant(session, async () =>
        getMyEntity(id, { repo: new PrismaMyRepository() }),
      );
      return jsonOk(entity);
    }
    return jsonError(404, `Unknown __slice__ endpoint: ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}
