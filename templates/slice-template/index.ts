/**
 * API pública del slice __slice__. Los consumidores (otros slices, routes)
 * importan SOLO desde este archivo — no profundizan en application/ o infrastructure/.
 */
export type { MyEntity, MyEntityId } from "~/contexts/__slice__/domain/entities/MyEntity";
export { MyEntityNotFoundError, __Slice__Error } from "~/contexts/__slice__/domain/errors";
export { getMyEntity } from "~/contexts/__slice__/application/myUseCase";
