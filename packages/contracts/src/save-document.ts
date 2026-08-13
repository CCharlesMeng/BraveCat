/**
 * 存档文档信封：schema 版本 + 导出时间 + 黑盒 state。
 *
 * 单一来源：packages/core 的 save 模块与 services/api 都从这里取
 * 类型与版本常量。本文件刻意不依赖 zod，客户端引用零运行时成本；
 * 服务端校验 schema 见 save-document-schema.ts。
 */
export const SAVE_SCHEMA_VERSION = 4 as const

export interface SaveDocument<TState = unknown> {
  schemaVersion: number
  exportedAt: number
  state: TState
}
