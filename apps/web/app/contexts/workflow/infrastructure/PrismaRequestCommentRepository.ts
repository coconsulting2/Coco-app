/**
 * @module PrismaRequestCommentRepository
 * @description Adapter Prisma del puerto `RequestCommentRepository`. Las
 * mutaciones se envuelven en `withRls` (transaccional) para garantizar
 * aislamiento cross-tenant.
 */
import prisma from "~/platform/db/prisma.server.js";
import { withRls } from "~/platform/db/rls.server.js";
import type {
  RequestCommentInsert,
  RequestCommentQuery,
  RequestCommentRaw,
  RequestCommentRepository,
} from "~/contexts/workflow/domain/ports/RequestCommentRepository.js";

const PARTIAL_SELECT = {
  id: true,
  user: {
    select: {
      userId: true,
      userName: true,
      role: { select: { roleName: true } },
    },
  },
  content: true,
  at: true,
} as const;

export class PrismaRequestCommentRepository implements RequestCommentRepository {
  async findRequestOrgId(requestId: number): Promise<{ organizationId: bigint } | null> {
    return prisma.request.findUnique({
      where: { requestId },
      select: { organizationId: true },
    });
  }

  async findUserOrgId(userId: number): Promise<{ organizationId: bigint } | null> {
    return prisma.user.findUnique({
      where: { userId },
      select: { organizationId: true },
    });
  }

  async insertComment(organizationId: bigint, data: RequestCommentInsert): Promise<void> {
    await withRls(organizationId, {}, async (tx) => {
      await tx.requestComment.create({ data });
    });
  }

  async listComments(
    organizationId: bigint,
    query: RequestCommentQuery,
  ): Promise<RequestCommentRaw[]> {
    return withRls(organizationId, {}, async (tx) =>
      tx.requestComment.findMany({ ...query, select: PARTIAL_SELECT }),
    ) as Promise<RequestCommentRaw[]>;
  }
}
