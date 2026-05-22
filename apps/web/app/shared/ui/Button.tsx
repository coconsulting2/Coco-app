/**
 * @file Button.tsx (shim)
 * @description Re-export desde `@coco/ui-kit`. El componente real vive ahí.
 * Mantenemos este shim para que los imports legacy `@components/Button` sigan
 * funcionando mientras consumidores se migran a `@coco/ui-kit` directo.
 */
export { Button as default } from "@coco/ui-kit";
