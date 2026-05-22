/**
 * @module PrismaApprovalInboxQueries
 * @description Adapter Prisma del port `ApprovalInboxQueries`. Filtra por
 * `workflowPreSnapshot` JSON path; fallback opcional por jerarquía si
 * `WORKFLOW_APPROVAL_MODE=hierarchy`.
 */
import prisma from "~/platform/db/prisma.server.js";
import type {
  ApprovalInboxQueries,
  ApprovalInboxItem,
  ApprovalInboxQueryOpts,
} from "~/contexts/approvals/domain/ports/ApprovalInboxQueries.js";

type SnapshotFilter = { workflowPreSnapshot: { path: string[]; equals: number } };
type FallbackFilter = {
  AND: [{ workflowPreSnapshot: { equals: null } }, { userId: { in: number[] } }];
};

async function getDirectSubordinates(managerUserId: number): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: { managerUserId: Number(managerUserId), active: true },
    select: { userId: true },
  });
  return rows.map((r) => Number(r.userId));
}

async function getSubordinatesAtDepth(rootUserId: number, depth: number): Promise<number[]> {
  if (!Number.isFinite(depth) || depth <= 0) return [];
  let frontier: number[] = [Number(rootUserId)];
  const visited = new Set<number>(frontier);
  for (let i = 0; i < depth; i += 1) {
    const next: number[] = [];
    for (const u of frontier) {
      const direct = await getDirectSubordinates(u);
      for (const s of direct) {
        if (visited.has(s)) continue;
        visited.add(s);
        next.push(s);
      }
    }
    frontier = next;
    if (frontier.length === 0) return [];
  }
  return frontier;
}

export class PrismaApprovalInboxQueries implements ApprovalInboxQueries {
  async findByApprover(
    actorUserId: number,
    statusId: 2 | 3,
    opts: ApprovalInboxQueryOpts = {},
  ): Promise<ApprovalInboxItem[]> {
    const actor = Number(actorUserId);
    if (!Number.isFinite(actor) || actor < 1) return [];
    if (statusId !== 2 && statusId !== 3) return [];

    const tierField = statusId === 2 ? "n1UserId" : "n2UserId";
    const tierDepth = statusId === 2 ? 1 : 2;
    const hierarchyMode =
      String(process.env.WORKFLOW_APPROVAL_MODE ?? "").toLowerCase() === "hierarchy";

    const orClauses: Array<SnapshotFilter | FallbackFilter> = [
      { workflowPreSnapshot: { path: [tierField], equals: actor } },
    ];
    if (hierarchyMode) {
      const subs = await getSubordinatesAtDepth(actor, tierDepth);
      if (subs.length > 0) {
        orClauses.push({
          AND: [
            { workflowPreSnapshot: { equals: null } },
            { userId: { in: subs } },
          ],
        });
      }
    }

    const where: Record<string, unknown> = {
      requestStatusId: statusId,
      OR: orClauses,
    };
    if (opts.organizationId != null && String(opts.organizationId).trim() !== "") {
      where.organizationId = BigInt(String(opts.organizationId).trim());
    }

    const requests = await prisma.request.findMany({
      where,
      include: {
        user: { include: { department: true } },
        requestStatus: true,
        routeRequests: {
          include: { route: { include: { destinationCountry: true } } },
          orderBy: { route: { routerIndex: "asc" } },
          take: 1,
        },
      },
      orderBy: { creationDate: "desc" },
      ...(opts.n ? { take: Number(opts.n) } : {}),
    });

    return requests.map((r) => {
      const firstRoute = r.routeRequests[0]?.route;
      return {
        requestId: r.requestId,
        userId: r.userId,
        destinationCountry: firstRoute?.destinationCountry?.countryName ?? null,
        beginningDate: firstRoute?.beginningDate ?? null,
        endingDate: firstRoute?.endingDate ?? null,
        requestStatus: r.requestStatus.status,
        requesterName: r.user?.userName ?? null,
        departmentName: r.user?.department?.departmentName ?? null,
      };
    });
  }
}
