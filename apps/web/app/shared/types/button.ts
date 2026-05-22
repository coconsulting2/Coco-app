/**
 * @file button.ts (shim)
 * @description Re-export desde `@coco/ui-kit`. La fuente de verdad vive en el
 * paquete UI-kit; este shim mantiene compatibilidad con imports `@type/button`.
 */
export {
  allowedVariants,
  allowedColors,
  allowedSizes,
  getButtonClasses,
  type ButtonVariant,
  type ButtonColor,
  type ButtonSize,
  type ButtonClassesProps,
} from "@coco/ui-kit";
