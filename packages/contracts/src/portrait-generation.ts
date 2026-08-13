/**
 * AIGC 形象生成的零依赖常量：照片上传约束与 job 终态列表。
 *
 * 本文件刻意不依赖 zod（与 save-document.ts 同一模式）：客户端
 * （packages/core/cloud）需要在不引入 zod 运行时的前提下复用这些
 * 常量做前端校验与轮询终止判断；zod schema 见 portraits.ts。
 */

/** 允许上传的照片格式；服务端按魔数校验，不信任声明。 */
export const PORTRAIT_PHOTO_CONTENT_TYPES = ['image/png', 'image/jpeg'] as const

export type PortraitPhotoContentType =
  (typeof PORTRAIT_PHOTO_CONTENT_TYPES)[number]

/**
 * 照片二进制上限（3MB）。上传走 JSON + base64（约 ×4/3 膨胀），
 * 3MB 二进制 ≈ 4MB base64，落在服务端 5MB bodyLimit 之内。
 */
export const MAX_PORTRAIT_PHOTO_BYTES = 3 * 1024 * 1024

/** 生成 job 的终态：轮询到这三种状态即可停止。 */
export const SETTLED_GENERATION_JOB_STATUSES = [
  'awaiting_confirm',
  'confirmed',
  'failed',
] as const

export type SettledGenerationJobStatus =
  (typeof SETTLED_GENERATION_JOB_STATUSES)[number]
