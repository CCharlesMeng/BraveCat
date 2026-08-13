/**
 * 运行时资产的 CDN base URL 注入点（Phase 1b 资源 CDN 化）。
 *
 * 构建期通过 `VITE_ASSET_BASE_URL` 注入（如 https://assets.example.com，
 * 不带尾部斜杠；与发布脚本 scripts/publish-assets-oss.mjs 的
 * ASSET_CDN_BASE_URL 取同一个值，见根目录 .env.example）。
 *
 * 默认空字符串：AssetResolver 保持恒等解析，相对根路径加载，
 * 与 CDN 引入前的行为完全一致。
 */
export const assetBaseUrl: string = import.meta.env.VITE_ASSET_BASE_URL ?? ''
