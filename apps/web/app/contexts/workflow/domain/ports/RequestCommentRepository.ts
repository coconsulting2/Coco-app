/**
 * @module RequestCommentRepository
 * @description Puerto del slice workflow para queries de Request_Comment.
 * Las queries Prisma + `withRls` viven en
 * `infrastructure/PrismaRequestCommentRepository.ts`.
 */

export type RequestCommentInsert = {
  requestId: number;
  userId: number;
  /** Content cifrado (los use-cases ya lo cifran). */
  content: string;
};

export type RequestCommentQuery = {
  where: { requestId: number };
  take: number;
  orderBy: { id: "asc" | "desc" };
  skip?: number;
  cursor?: { id: number };
};

export type RequestCommentRaw = {
  id: number;
  at: Date;
  /** Content cifrado. Los use-cases descifran. */
  content: string;
  user: {
    userId: number;
    userName: string;
    role: { roleName: string } | null;
  };
};

export interface RequestCommentRepository {
  findRequestOrgId(requestId: number): Promise<{ organizationId: bigint } | null>;
  findUserOrgId(userId: number): Promise<{ organizationId: bigint } | null>;
  insertComment(organizationId: bigint, data: RequestCommentInsert): Promise<void>;
  listComments(
    organizationId: bigint,
    query: RequestCommentQuery,
  ): Promise<RequestCommentRaw[]>;
}
