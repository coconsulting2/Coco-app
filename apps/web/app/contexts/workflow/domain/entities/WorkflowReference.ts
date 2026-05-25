/**
 * @module WorkflowReference
 * @description Tipos puros de los catálogos auxiliares que el panel admin de
 * workflow usa (departamentos + roles del tenant). Mappers viven en
 * `infrastructure/`.
 */

export type WorkflowDepartment = {
  departmentId: number;
  departmentName: string;
  costsCenter: string | null;
};
