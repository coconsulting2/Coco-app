/**
 * @module WorkflowCommentsService
 * @description Adapter para el port `CommentsService`. Wrappea el use-case
 * `createRequestComment` pre-wired del slice `workflow` (que encapsula
 * cifrado AES + persistencia Prisma + RLS).
 */
import { createRequestComment } from "~/contexts/workflow/index.js";
import type {
  CommentsService,
  PostRequestCommentInput,
  PostRequestCommentResult,
} from "~/contexts/receipts-cfdi/domain/ports/CommentsService.js";

export class WorkflowCommentsService implements CommentsService {
  async postRequestComment(input: PostRequestCommentInput): Promise<PostRequestCommentResult> {
    const result = await createRequestComment(input.userId, input.requestId, input.content);
    return result;
  }
}
