/**
 * Errores tipados del dominio. Independientes de HTTP.
 */
export class __Slice__Error extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "__Slice__Error";
  }
}

export class MyEntityNotFoundError extends __Slice__Error {
  constructor(id: number) {
    super(`Entity ${id} not found`, "ENTITY_NOT_FOUND");
  }
}
