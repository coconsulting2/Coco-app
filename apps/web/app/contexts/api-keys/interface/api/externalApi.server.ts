/**
 * @module externalApi.server
 * @description Dispatcher /api/external/*. Autentica con `X-API-Key` (no JWT).
 * Cada request deja traza en api_key_logs (apiKeyAuditLog).
 */
import { jsonOk, jsonError, jsonFromError } from "~/platform/http/responses";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { authenticateApiKey, apiKeyAuditLog, requireAnyApiKeyPermission } from "~/platform/api-key/api-key-auth.server.js";

type DispatchArgs = { request: Request; subpath: string };

export async function dispatchExternalApi({ request, subpath }: DispatchArgs): Promise<Response> {
  const method = request.method.toUpperCase();
  const path = subpath.split("?")[0] ?? "";

  try {
    const apiKey = await authenticateApiKey(request);
    if (!apiKey) {
      return jsonError(401, "Invalid or missing API key", "INVALID_API_KEY");
    }
    await apiKeyAuditLog(apiKey, { method, path });

    if (method === "GET" && path === "accounting/preview") {
      requireAnyApiKeyPermission(apiKey, "accounting:export", "accounts_payable:attend");
      return jsonOk({
        ok: true,
        org_id: String(apiKey.orgId),
        message: "read-only accounting integration preview",
      });
    }
    return jsonError(404, `Unknown external endpoint: ${method} ${path}`, "UNKNOWN_ENDPOINT");
  } catch (err) {
    return jsonFromError(err);
  }
}
