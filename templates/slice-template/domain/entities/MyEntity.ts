/**
 * @file app/contexts/__slice__/domain/entities/MyEntity.ts
 * Reemplaza por la entidad real del bounded context. No depende de Prisma.
 */
export type MyEntityId = number;

export type MyEntity = {
  id: MyEntityId;
  // ... campos del dominio (camelCase, independientes de BD)
};
