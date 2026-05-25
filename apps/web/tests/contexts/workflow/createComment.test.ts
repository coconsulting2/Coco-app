/**
 * Unit test del use-case `createComment` con stub in-memory del port
 * `RequestCommentRepository` — sin DB. Cubre:
 *  - request inexistente → { success:false, "Invalid request id" }
 *  - user inexistente → { success:false, "Invalid user id" }
 *  - happy path → insertComment llamado con content cifrado, { success:true }
 *  - FK violation (P2003) → { success:false, "Invalid user id or request id" }
 */
import { describe, it, expect, vi } from "vitest";

// El use-case importa el logger pino (infraestructura con side-effects de
// transport irrelevantes al unit). Lo aislamos con un stub no-op.
vi.mock("~/platform/logger/log/logger.js", () => ({
  Logger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    trace: () => {},
    debug: () => {},
  }),
}));

import { createComment } from "~/contexts/workflow/application/manageRequestComments";
import type {
  RequestCommentRepository,
  RequestCommentInsert,
} from "~/contexts/workflow/domain/ports/RequestCommentRepository";

function makeRepo(
  overrides: Partial<RequestCommentRepository> = {},
): RequestCommentRepository {
  return {
    findRequestOrgId: async () => ({ organizationId: 101n }),
    findUserOrgId: async () => ({ organizationId: 101n }),
    insertComment: vi.fn(async () => {}),
    listComments: async () => [],
    ...overrides,
  };
}

describe("createComment", () => {
  it("rechaza request inexistente", async () => {
    const result = await createComment(1, 99, "hola", {
      comments: makeRepo({ findRequestOrgId: async () => null }),
    });
    expect(result).toEqual({ success: false, error: "Invalid request id" });
  });

  it("rechaza user inexistente", async () => {
    const result = await createComment(99, 1, "hola", {
      comments: makeRepo({ findUserOrgId: async () => null }),
    });
    expect(result).toEqual({ success: false, error: "Invalid user id" });
  });

  it("inserta el comentario cifrado en el happy path", async () => {
    const insertComment = vi.fn(async (_org: bigint, _data: RequestCommentInsert) => {});
    const result = await createComment(1, 1, "hola mundo", {
      comments: makeRepo({ insertComment }),
    });
    expect(result).toEqual({ success: true });
    expect(insertComment).toHaveBeenCalledOnce();
    const [, data] = insertComment.mock.calls[0]!;
    expect(data.userId).toBe(1);
    expect(data.requestId).toBe(1);
    // El contenido se persiste cifrado (no en texto plano).
    expect(data.content).not.toBe("hola mundo");
  });

  it("traduce FK violation (P2003) a error de validación", async () => {
    const result = await createComment(1, 1, "hola", {
      comments: makeRepo({
        insertComment: async () => {
          throw Object.assign(new Error("FK"), { code: "P2003" });
        },
      }),
    });
    expect(result).toEqual({
      success: false,
      error: "Invalid user id or request id",
    });
  });
});
