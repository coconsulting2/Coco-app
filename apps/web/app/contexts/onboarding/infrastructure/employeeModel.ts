/**
 * @module employeeModel
 * @description Data access layer for empleado catalog sync + manager hierarchy.
 * Prisma vive solo aquí.
 */
import prisma from "~/platform/db/prisma.server.js";
import type { Prisma } from "@coco/db";

const EmployeeModel = {
  async findByNoEmpleado(organizationId: bigint | number | string, noEmpleado: string) {
    return prisma.empleado.findUnique({
      where: {
        organizationId_noEmpleado: {
          organizationId: BigInt(organizationId),
          noEmpleado: String(noEmpleado),
        },
      },
    });
  },

  async createEmpleado(data: Prisma.EmpleadoUncheckedCreateInput) {
    return prisma.empleado.create({ data });
  },

  async updateEmpleado(
    organizationId: bigint | number | string,
    noEmpleado: string,
    data: Prisma.EmpleadoUncheckedUpdateInput,
  ) {
    return prisma.empleado.update({
      where: {
        organizationId_noEmpleado: {
          organizationId: BigInt(organizationId),
          noEmpleado: String(noEmpleado),
        },
      },
      data,
    });
  },

  /** Lista empleados por organización. */
  async listByOrganization(
    organizationId: bigint | number | string,
    { status = null }: { status?: string | null } = {},
  ) {
    const where: Prisma.EmpleadoWhereInput = { organizationId: BigInt(organizationId) };
    if (status) where.status = String(status).toUpperCase();
    return prisma.empleado.findMany({ where, orderBy: { noEmpleado: "asc" } });
  },

  /** Lookup directo del managerUserId — soporta el helper de jerarquía. */
  async getManagerUserId(userId: number): Promise<number | null> {
    const row = await prisma.user.findUnique({
      where: { userId: Number(userId) },
      select: { managerUserId: true },
    });
    return row?.managerUserId ?? null;
  },

  /** Subordinados directos (userIds cuyo managerUserId == userId). */
  async getDirectSubordinates(managerUserId: number): Promise<number[]> {
    const rows = await prisma.user.findMany({
      where: { managerUserId: Number(managerUserId) },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  },
};

export default EmployeeModel;
