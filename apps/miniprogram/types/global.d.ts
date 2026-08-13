/// <reference types="@tarojs/taro" />

declare module '*.png'
declare module '*.gif'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.svg'
declare module '*.css'
declare module '*.scss'

/**
 * 与 packages/core/src/vite-env.d.ts 对齐：core 的 starterCatalog 依赖
 * `import.meta.env.DEV`（Taro 侧用 vite 编译器，构建期同样会静态替换）。
 */
interface ImportMeta {
  readonly env: {
    readonly DEV: boolean
  }
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production'
    TARO_ENV: 'weapp' | 'h5'
    TARO_APP_ID: string
    /** 运行时资产 CDN base URL；开发期可指向本地静态服务器（见 README）。 */
    TARO_APP_ASSET_BASE_URL?: string
    /** 云功能 API 地址；留空 = 云同步整体关闭（见 README 云同步一节）。 */
    TARO_APP_API_BASE_URL?: string
  }
}
