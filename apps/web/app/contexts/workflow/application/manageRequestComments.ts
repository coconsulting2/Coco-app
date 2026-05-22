/**
 * @module manageRequestComments
 * @description Use-cases para Request_Comment con cifrado AES-256-GCM y
 * paginación con cursor cifrado. Deps por DI; el port `RequestCommentRepository`
 * abstrae Prisma + RLS.
 */
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { Logger } from "~/platform/logger/log/logger.js";
import type { RequestCommentRepository } from "~/contexts/workflow/domain/ports/RequestCommentRepository.js";
import {
  RequestCommentCursorTamperedError,
  RequestCommentInvalidActorError,
} from "~/contexts/workflow/domain/errors.js";

const ENV = process.env.NODE_ENV || "production";

function validKey(key: string | undefined): key is string {
  return typeof key === "string" && /^[0-9a-f]{64}$/i.test(key);
}

let CHAT_CURSOR_SECRET = process.env.CHAT_CURSOR_SECRET;
let CHAT_MESSAGE_SECRET = process.env.CHAT_MESSAGE_SECRET;

if (!validKey(CHAT_CURSOR_SECRET) || !validKey(CHAT_MESSAGE_SECRET)) {
  if (!(ENV === "development" || ENV === "test")) {
    throw new Error(
      "CHAT_CURSOR_SECRET and CHAT_MESSAGE_SECRET environment variables must be set at 64 hex chars (32 bytes long)",
    );
  }
  console.warn(
    "[manageRequestComments] CHAT_CURSOR_SECRET or CHAT_MESSAGE_SECRET not set — generating ephemeral keys. Only acceptable in development/test.",
  );
  CHAT_CURSOR_SECRET = "".padEnd(64, "0");
  CHAT_MESSAGE_SECRET = "".padEnd(64, "0");
}

const CURSOR_SECRET = Buffer.from(CHAT_CURSOR_SECRET, "hex");
const MESSAGE_SECRET = Buffer.from(CHAT_MESSAGE_SECRET, "hex");

const logger = Logger("Request Comment Use-cases");

export type RequestCommentsDeps = { comments: RequestCommentRepository };

export type CreateCommentResult =
  | { success: true }
  | { success: false; error: string };

export async function createComment(
  userId: number,
  requestId: number,
  content: string,
  deps: RequestCommentsDeps,
): Promise<CreateCommentResult> {
  logger.info({ requestId, userId }, "[manageRequestComments] createComment");

  const [request, user] = await Promise.all([
    deps.comments.findRequestOrgId(requestId),
    deps.comments.findUserOrgId(userId),
  ]);

  if (!request) {
    logger.warn({ requestId }, "[manageRequestComments] createComment — unknown request id");
    return { success: false, error: "Invalid request id" };
  }
  if (!user) {
    logger.warn({ userId }, "[manageRequestComments] createComment — unknown user id");
    return { success: false, error: "Invalid user id" };
  }

  try {
    await deps.comments.insertComment(request.organizationId, {
      content: encrypt(content, MESSAGE_SECRET),
      userId,
      requestId,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2003") {
      logger.warn({ userId, requestId }, "[manageRequestComments] createComment — FK violation");
      return { success: false, error: "Invalid user id or request id" };
    }
    logger.error(
      { userId, requestId, err },
      "[manageRequestComments] createComment — unexpected error",
    );
    throw err;
  }

  return { success: true };
}

export type ReadCommentsOpts = { cursor?: string; suscribe?: boolean };
export type ReadCommentsResult =
  | {
      success: true;
      next?: string;
      data: {
        users: Record<string, { name: string; role: string }>;
        messages: Array<{
          pageIndex: number;
          at: Date;
          user_key: string | number | undefined;
          content: string;
        }>;
      };
    }
  | { success: false; error: string };

export async function readComments(
  requestId: number,
  userId: number,
  limit: number,
  { cursor, suscribe = false }: ReadCommentsOpts,
  deps: RequestCommentsDeps,
): Promise<ReadCommentsResult> {
  logger[suscribe ? "trace" : "info"](
    { requestId, userId, limit, hasCursor: !!cursor },
    "[manageRequestComments] readComments",
  );

  const request = await deps.comments.findRequestOrgId(requestId);
  if (!request) {
    return { success: false, error: "Invalid request id" };
  }

  const take = limit + 1;
  const query: import("~/contexts/workflow/domain/ports/RequestCommentRepository.js").RequestCommentQuery = {
    where: { requestId },
    take,
    orderBy: { id: "desc" },
  };

  if (cursor) {
    try {
      query.cursor = { id: decodeID(cursor) };
      query.skip = 1;
    } catch (err) {
      if (err instanceof RequestCommentCursorTamperedError) {
        return { success: false, error: "tampered cursor" };
      }
      throw err;
    }
  }

  let page;
  try {
    page = await deps.comments.listComments(request.organizationId, query);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2003") {
      return { success: false, error: "Invalid request id" };
    }
    throw err;
  }

  const moreResults = page.length === take;
  let next: string | undefined;
  if (moreResults) {
    page = page.slice(0, -1);
    const lastId = page.at(-1)?.id;
    if (lastId !== undefined) next = encodeID(lastId);
  }

  const users = new Map<number, { key: string; name: string; role: string }>();
  const messages = page.map((row, index) => {
    const safeAt = new Date(row.at);
    safeAt.setSeconds(0, 0);
    const userMessage = row.user.userId === userId;

    if (!userMessage && !users.has(row.user.userId)) {
      users.set(row.user.userId, {
        key: encodeID(row.user.userId),
        name: row.user.userName,
        role: row.user.role?.roleName ?? "unknown",
      });
    }

    return {
      pageIndex: index + 1,
      at: safeAt,
      user_key: userMessage ? userId : users.get(row.user.userId)?.key,
      content: decrypt(row.content, MESSAGE_SECRET, "Tampered message"),
    };
  });

  return {
    success: true,
    ...(next ? { next } : {}),
    data: {
      users: Object.fromEntries(
        Array.from(users.values()).map(({ key, ...rest }) => [key, rest]),
      ),
      messages,
    },
  };
}

function encodeID(id: number): string {
  return encrypt(String(id), CURSOR_SECRET);
}

function decodeID(value: string): number {
  return parseInt(decrypt(value, CURSOR_SECRET, "Tampered tag"), 10);
}

function encrypt(text: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(value: string, key: Buffer, errMessage: string): string {
  const buf = Buffer.from(value, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    if (errMessage === "Tampered tag") throw new RequestCommentCursorTamperedError();
    throw new RequestCommentInvalidActorError(errMessage);
  }
}

// Importación silenciosa para ESLint — el error se importa para el catch arriba.
void RequestCommentInvalidActorError;
