/**
 * core 目前仅在 Vite/Vitest 宿主下运行，starterCatalog 依赖
 * `import.meta.env.DEV` 做构建期死代码剔除（生产包剥离 dev 素材目录），
 * 不能改写该表达式。未来非 Vite 宿主（Node 服务端重放）接入时，
 * 应把该开关拆成注入式配置端口。
 */
interface ImportMeta {
  readonly env: {
    readonly DEV: boolean
  }
}
