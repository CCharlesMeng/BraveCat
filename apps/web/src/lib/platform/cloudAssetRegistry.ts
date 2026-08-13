/**
 * 云端形象资产的会话内 URL 登记表。
 *
 * 已确认的 AIGC 形象以「/ + 对象存储 key」作为稳定资产路径进入目录与
 * 明信片配方（配方会把路径冻结进存档）；产出图字节经鉴权接口取回后
 * 生成本会话的 blob URL 登记在此。AssetResolver 解析时先查这里，
 * 未登记的路径按原有 base URL 规则解析——默认构建（无云）登记表恒空，
 * 行为与纯本地版完全一致。
 */
const cloudAssetUrls = new Map<string, string>()

export const registerCloudAssetUrl = (assetPath: string, url: string): void => {
  cloudAssetUrls.set(assetPath, url)
}

export const lookupCloudAssetUrl = (assetPath: string): string | undefined =>
  cloudAssetUrls.get(assetPath)
