/**
 * @module @coco/ui-kit
 * @description Átomos puros del design system editorial CocoConsulting.
 * Sin dependencia de slices, ni data fetching, ni contexts — solo React,
 * Tailwind v4 y tokens CSS variables (`--color-*`, `--radius-*`).
 *
 * Para que las clases Tailwind se generen, asegúrate de incluir
 * `packages/ui-kit/src/**` en el `content` config de Tailwind del consumer
 * (apps/web ya lo hace).
 */
export { default as Button } from "#/Button.js";
export { default as Modal } from "#/Modal.js";
export { default as ModalWrapper } from "#/ModalWrapper.js";
export { default as Alert } from "#/Alert.js";
export { default as Badge } from "#/Badge.js";
export { default as InputField } from "#/InputField.js";
export { default as Select } from "#/Select.js";
export { default as TextArea } from "#/TextArea.js";
export { default as Toast } from "#/Toast.js";
export { default as ProgressBar } from "#/ProgressBar.js";
export { default as MaterialIcon } from "#/MaterialIcon.js";

export {
  allowedVariants,
  allowedColors,
  allowedSizes,
  getButtonClasses,
  type ButtonVariant,
  type ButtonColor,
  type ButtonSize,
  type ButtonClassesProps,
} from "#/internal/button.js";

export {
  InputPatterns,
  type BaseInputProps,
  type InputTypes,
} from "#/internal/input.js";

export {
  MODAL_TYPES,
  MODAL_STYLES,
  type ModalType,
} from "#/internal/modal.js";

export {
  PROGRESS_BAR_COLORS,
  PROGRESS_BAR_TRACK,
  PROGRESS_BAR_SIZES,
  type ProgressBarColor,
  type ProgressBarSize,
} from "#/internal/progressBar.js";
