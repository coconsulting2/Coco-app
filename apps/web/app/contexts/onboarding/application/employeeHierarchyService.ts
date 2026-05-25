/**
 * @module employeeHierarchyService
 * @description Utilidades de jerarquía organizacional (adjacency list)
 * basadas en User.managerUserId. Cumple regla "Prisma solo en infrastructure":
 * la query vive en `infrastructure/employeeModel.ts`.
 */
import EmployeeModel from "~/contexts/onboarding/infrastructure/employeeModel.js";

const Authorizer = {
  getManagerUserId: (userId: number): Promise<number | null> =>
    EmployeeModel.getManagerUserId(userId),
  getDirectSubordinates: (userId: number): Promise<number[]> =>
    EmployeeModel.getDirectSubordinates(userId),
};

/** Error de jerarquía con status HTTP (parity con el legacy). */
type HierarchyError = { status: number; message: string };

/**
 * Cadena de aprobación hacia arriba (jefe directo, jefe del jefe, ...).
 */
export async function getApprovalChain(userId: number, maxDepth = 8): Promise<number[]> {
  const chain: number[] = [];
  const seen = new Set<number>([Number(userId)]);
  let current = Number(userId);

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const managerId = await Authorizer.getManagerUserId(current);
    if (managerId == null) break;
    if (seen.has(Number(managerId))) {
      const err: HierarchyError = { status: 409, message: "Cycle detected in manager hierarchy" };
      throw err;
    }
    chain.push(Number(managerId));
    seen.add(Number(managerId));
    current = Number(managerId);
  }

  return chain;
}

/**
 * Subordinados transitivos (BFS) de un manager.
 */
export async function getSubordinatesRecursive(
  managerUserId: number,
  maxNodes = 2000,
): Promise<number[]> {
  const visited = new Set<number>();
  const out: number[] = [];
  const queue: number[] = [Number(managerUserId)];

  while (queue.length > 0 && out.length < maxNodes) {
    const current = queue.shift() as number;
    if (visited.has(current)) continue;
    visited.add(current);

    const direct = await Authorizer.getDirectSubordinates(current);
    for (const s of direct) {
      if (!visited.has(Number(s))) {
        out.push(Number(s));
        queue.push(Number(s));
      }
    }
  }

  return out;
}

/**
 * Profundidad de aprobación disponible para un usuario.
 */
export async function getHierarchyDepth(userId: number, maxDepth = 8): Promise<number> {
  const chain = await getApprovalChain(userId, maxDepth);
  return chain.length;
}

/**
 * Indica si asignar `proposedManagerUserId` como `User.managerUserId` de `userId` crearía un ciclo
 * en la jerarquía actual (adjacency list). `null` / `undefined` en el jefe propuesto nunca crea ciclo.
 */
export async function wouldCreateManagerCycle(
  userId: number,
  proposedManagerUserId: number | null | undefined,
  maxDepth = 32,
): Promise<boolean> {
  const u = Number(userId);
  if (!Number.isFinite(u) || u < 1) return false;
  if (proposedManagerUserId === undefined || proposedManagerUserId === null) {
    return false;
  }
  const m = Number(proposedManagerUserId);
  if (!Number.isFinite(m) || m < 1) return false;
  if (m === u) return true;

  const seen = new Set<number>([m]);
  let current = m;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const next = await Authorizer.getManagerUserId(current);
    if (next === null || next === undefined) return false;
    const n = Number(next);
    if (n === u) return true;
    if (seen.has(n)) return true;
    seen.add(n);
    current = n;
  }
  return true;
}

export default {
  getApprovalChain,
  getSubordinatesRecursive,
  getHierarchyDepth,
  wouldCreateManagerCycle,
};
