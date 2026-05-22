/**
 * @module approverResolver
 * @description Resuelve usuarios N1 / N2 por organización (y preferencia
 * mismo departamento). DI-style: recibe el prisma client (`db`) como
 * parámetro — funciona dentro de transacciones o con el cliente global.
 */

const N1_NAME = "N1";
const N2_NAME = "N2";

type Db = {
  user: {
    findFirst(args: {
      where: Record<string, unknown>;
      select: { userId: true };
      orderBy?: Record<string, "asc" | "desc">;
    }): Promise<{ userId: number } | null>;
    findUnique(args: {
      where: { userId: number };
      select: { managerUserId: true };
    }): Promise<{ managerUserId: number | null } | null>;
  };
};

export type ResolvedApprovers = {
  n1UserId: number | null;
  n2UserId: number | null;
  approverIds: Array<number | null>;
};

export async function resolveN1N2Approvers(
  db: Db,
  organizationId: bigint | null | undefined,
  departmentId: number | null | undefined,
  userId: number | null | undefined,
): Promise<ResolvedApprovers> {
  if (organizationId === null || organizationId === undefined) {
    return { n1UserId: null, n2UserId: null, approverIds: [] };
  }

  const org = BigInt(organizationId);
  const dept = departmentId != null ? Number(departmentId) : null;

  const findOne = async (roleName: string, preferDept: number | null): Promise<number | null> => {
    const base = {
      organizationId: org,
      active: true,
      role: { roleName },
    };
    if (preferDept != null) {
      const u = await db.user.findFirst({
        where: { ...base, departmentId: preferDept },
        select: { userId: true },
      });
      if (u) return u.userId;
    }
    const u2 = await db.user.findFirst({
      where: base,
      select: { userId: true },
      orderBy: { userId: "asc" },
    });
    return u2 ? u2.userId : null;
  };

  const approverIds: number[] = [];
  if (userId) {
    let currentUserId = Number(userId);
    for (let i = 0; i < 10; i++) {
      const currentUser = await db.user.findUnique({
        where: { userId: currentUserId },
        select: { managerUserId: true },
      });
      if (currentUser && currentUser.managerUserId) {
        approverIds.push(currentUser.managerUserId);
        currentUserId = currentUser.managerUserId;
      } else {
        break;
      }
    }
  }

  const [fallbackN1, fallbackN2] = await Promise.all([
    findOne(N1_NAME, dept),
    findOne(N2_NAME, dept),
  ]);

  const n1UserId = approverIds[0] || fallbackN1;
  const n2UserId = approverIds[1] || fallbackN2;

  const out: Array<number | null> = [...approverIds];
  if (out.length === 0) {
    if (n1UserId) out.push(n1UserId);
    if (n2UserId) out.push(n2UserId);
  } else if (out.length === 1) {
    if (n2UserId) out.push(n2UserId);
  }

  return { n1UserId, n2UserId, approverIds: out };
}
