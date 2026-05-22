/**
 * @file app/contexts/__slice__/domain/ports/MyRepository.ts
 * Interface del repositorio. El adapter concreto vive en infrastructure/.
 */
import type { MyEntity, MyEntityId } from "~/contexts/__slice__/domain/entities/MyEntity";

export interface MyRepository {
  findById(id: MyEntityId): Promise<MyEntity | null>;
  list(): Promise<MyEntity[]>;
  // ... métodos del repo según necesite el dominio
}
