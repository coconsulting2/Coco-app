/**
 * @file app/contexts/__slice__/application/myUseCase.ts
 * Use-case ejemplar. Recibe el port por argumento (DI), NO importa Prisma
 * ni el adapter concreto. Esto permite testear sin BD.
 */
import type { MyRepository } from "~/contexts/__slice__/domain/ports/MyRepository";
import type { MyEntityId, MyEntity } from "~/contexts/__slice__/domain/entities/MyEntity";
import { MyEntityNotFoundError } from "~/contexts/__slice__/domain/errors";

export async function getMyEntity(id: MyEntityId, deps: { repo: MyRepository }): Promise<MyEntity> {
  const entity = await deps.repo.findById(id);
  if (!entity) throw new MyEntityNotFoundError(id);
  return entity;
}
