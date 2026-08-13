/**
 * 资产 URL 解析端口。
 *
 * 素材目录（starterCatalog、homeTheme forms/pieces 等）一律以根相对
 * 路径记录资产（`/scenes/…`、`/portraits/…`、`/assets/…`、`/dev-art/…`）。
 * core 在产出可渲染场景 / 可加载图层时经当前 AssetResolver 解析；
 * web 端默认相对根路径（恒等），CDN / 小程序端注入 base URL。
 */
export interface AssetResolver {
  resolve(assetPath: string): string
}

/** 只改写根相对路径；已解析的绝对 URL 原样返回，因此解析是幂等的。 */
export const createBaseUrlAssetResolver = (baseUrl: string): AssetResolver => {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return {
    resolve: (assetPath) => (
      assetPath.startsWith('/') ? `${trimmed}${assetPath}` : assetPath
    ),
  }
}

let activeResolver: AssetResolver = createBaseUrlAssetResolver('')

export const configureAssetResolver = (resolver: AssetResolver) => {
  activeResolver = resolver
}

export const resolveAssetUrl = (assetPath: string) => (
  activeResolver.resolve(assetPath)
)
