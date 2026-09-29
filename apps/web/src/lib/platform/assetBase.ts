/** 首发生产资源固定同源，保证安装后的离线缓存可用；开发保留 CDN 联调。 */
export const assetBaseUrl: string = import.meta.env.DEV ? (import.meta.env.VITE_ASSET_BASE_URL ?? '') : ''
