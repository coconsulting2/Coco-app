/**
 * @file app/contexts/__slice__/infrastructure/PrismaMyRepository.server.ts
 * Adapter concreto del MyRepository port — ÚNICO lugar que toca @prisma/client.
 * Mappea entre Prisma rows (snake_case en BD) y dominio (camelCase).
 */
import prisma from "~/platform/db/prisma.server";
import type { MyRepository } from "~/contexts/__slice__/domain/ports/MyRepository";
import type { MyEntity, MyEntityId } from "~/contexts/__slice__/domain/entities/MyEntity";

export class PrismaMyRepository implements MyRepository {
  async findById(id: MyEntityId): Promise<MyEntity | null> {
    // const row = await prisma.myTable.findUnique({ where: { id } });
    // if (!row) return null;
    // return { id: row.id /* ...mapper... */ };
    return null;
  }
  async list(): Promise<MyEntity[]> {
    return [];
  }
}
