/**
 * @module rls.server (apps/web)
 * @description Re-export delgado de @coco/db. Los call-sites en infrastructure/
 * importan applyRlsSetting/withRls/clearRlsSetting con la misma semántica que
 * antes; el paquete @coco/db usa `prismaBase` como cliente default (los SET
 * LOCAL no requieren ninguna extensión).
 */
export {
  applyRlsSetting,
  clearRlsSetting,
  withRls,
  type RlsTransaction,
} from "@coco/db";
