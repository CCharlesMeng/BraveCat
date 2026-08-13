/**
 * 五个平台端口的汇总出口。接口在 core，平台实现放各端
 * （web 实现见 apps/web/src/lib/platform/ports.ts）。
 *
 * - SaveStore：存档读写 / 导入导出（IndexedDB 实现暂随 save 模块）。
 * - PostcardCanvas：明信片合成所需的 canvas / 图片加载。
 * - SharePort：系统分享与 Blob 下载（未来含存相册）。
 * - Clock / RandomPort：时间源与随机熵源。
 * - AssetResolver：根相对资产路径 → 可加载 URL。
 */
export type {
  SaveDocument,
  SaveMigration,
  SaveStore,
  SaveStoreOptions,
} from '../save'
export type { Clock, ClockOptions } from '../time'
export type {
  PostcardRenderDependencies,
  PostcardRenderDependencies as PostcardCanvas,
  PostcardShareDependencies,
  PostcardShareDependencies as SharePort,
  PostcardShareResult,
} from '../postcards/composer'
export type { RandomPort } from './random'
export {
  configureAssetResolver,
  createBaseUrlAssetResolver,
  resolveAssetUrl,
} from './assetResolver'
export type { AssetResolver } from './assetResolver'
