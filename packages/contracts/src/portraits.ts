import { z } from 'zod'
import { PORTRAIT_PHOTO_CONTENT_TYPES } from './portrait-generation.js'

/**
 * Portrait 姿势 id 的 API 侧投影。
 * 姿势词汇的单一来源是 packages/core 的 portraitPoseVocabulary（含落脚面/
 * 承重点/锚点约定）；contracts 被 core 依赖、不能反向 import，故此处复制
 * id 列表，services/api 以对齐测试保证两侧一致（test/poses.test.ts）。
 */
export const portraitPoseSchema = z.enum([
  'sit',
  'sleep',
  'walk',
  'eat',
  'play',
  'gaze',
  'sniff',
  'reach',
  'stretch',
  'greet',
])

export type PortraitPose = z.infer<typeof portraitPoseSchema>

/** 一次生成产出的完整姿势套图集合（10 姿势）。 */
export const portraitGenerationPoses = portraitPoseSchema.options

/**
 * 生成 job 状态机：
 * pending → moderating → generating → qa → awaiting_confirm → confirmed / failed。
 */
export const generationJobStatusSchema = z.enum([
  'pending',
  'moderating',
  'generating',
  'qa',
  'awaiting_confirm',
  'confirmed',
  'failed',
])

export type GenerationJobStatus = z.infer<typeof generationJobStatusSchema>

/**
 * 自动 QA 检查项 id。检查语义来自姿势词汇（锚点/落脚面/承重点/目标物约定）
 * 与 spike 可行性文档的 QA 表（docs/art/candidates/aigc-portrait-spike-2026-08-13）。
 */
export const qaCheckIdSchema = z.enum([
  /** 产出必须是合法 PNG。 */
  'spec-format-png',
  /** 与现役资产一致的规格（1024×1024）。 */
  'spec-dimensions',
  /** 透明背景要求 alpha 通道（抠图后处理产物为 RGBA）。 */
  'spec-alpha-channel',
  /** support-contact-bottom-center 锚点：包围盒水平居中 + 底距公差（像素级，留接口）。 */
  'anchor-bottom-center',
  /** 有且仅有一只猫（视觉模型，留接口）。 */
  'single-subject',
  /** 落脚面与承重点符合姿势词汇（姿势分类/关键点，留接口）。 */
  'pose-support-contacts',
  /** portrait-contained 目标必须画入、scene-provided 目标不得烘入（视觉模型问答，留接口）。 */
  'interaction-target',
  /** 与基准姿势的花色一致性（直方图 + 色块拓扑，留接口）。 */
  'palette-consistency',
  /** alpha 质量：无孤岛/半透明噪点/同色光晕（留接口）。 */
  'alpha-quality',
])

export type QaCheckId = z.infer<typeof qaCheckIdSchema>

/** not_implemented 表示检查位已登记但尚未接入自动判定，不拦截管线。 */
export const qaCheckStatusSchema = z.enum(['pass', 'fail', 'not_implemented'])

export type QaCheckStatus = z.infer<typeof qaCheckStatusSchema>

export const qaCheckResultSchema = z.object({
  checkId: qaCheckIdSchema,
  pose: portraitPoseSchema,
  status: qaCheckStatusSchema,
  message: z.string().optional(),
})

export type QaCheckResult = z.infer<typeof qaCheckResultSchema>

/** 失败原因三分：审核拒绝 / 生成（含管线故障）失败 / 自动 QA 不过；均自动退回预扣次数。 */
export const generationFailureReasonSchema = z.enum([
  'moderation_rejected',
  'generation_failed',
  'qa_failed',
])

export type GenerationFailureReason = z.infer<
  typeof generationFailureReasonSchema
>

export const generationFailureSchema = z.object({
  reason: generationFailureReasonSchema,
  message: z.string(),
  /** qa_failed 时附带完整检查报告。 */
  qa: z.array(qaCheckResultSchema).optional(),
})

export type GenerationFailure = z.infer<typeof generationFailureSchema>

export const generationJobResultSchema = z.object({
  /** 各姿势产出图的对象存储 key（zod v4 record + enum 键 = 穷举全部姿势）。 */
  poses: z.record(portraitPoseSchema, z.string()),
  /** 自动 QA 报告（含 not_implemented 的语义类检查位）。 */
  qa: z.array(qaCheckResultSchema),
})

export type GenerationJobResult = z.infer<typeof generationJobResultSchema>

export const generationJobSchema = z.object({
  id: z.uuid(),
  status: generationJobStatusSchema,
  /** 用户上传照片的对象存储引用。 */
  photoKey: z.string(),
  failure: generationFailureSchema.optional(),
  result: generationJobResultSchema.optional(),
  /** 确认后产出的形象记录 id（ADR-0004：只向未来生效）。 */
  portraitId: z.uuid().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type GenerationJob = z.infer<typeof generationJobSchema>

/**
 * POST /v1/portraits/photos 请求：最小照片上传端点。
 * 走 JSON + base64 以复用现有 bodyLimit 与客户端字符串体 HTTP 端口；
 * 大小上限见 portrait-generation.ts 的 MAX_PORTRAIT_PHOTO_BYTES。
 * 生产接入 OSS 后可换成预签名 URL 直传，此端点随之退役。
 */
export const uploadPortraitPhotoRequestSchema = z.object({
  contentType: z.enum(PORTRAIT_PHOTO_CONTENT_TYPES),
  dataBase64: z.string().min(1),
})

export type UploadPortraitPhotoRequest = z.infer<
  typeof uploadPortraitPhotoRequestSchema
>

/** POST /v1/portraits/photos 响应（201）：photoKey 供提交生成时引用。 */
export const uploadPortraitPhotoResponseSchema = z.object({
  photoKey: z.string(),
})

export type UploadPortraitPhotoResponse = z.infer<
  typeof uploadPortraitPhotoResponseSchema
>

/**
 * GET /v1/portraits/generations/:jobId/poses/:pose 响应：产出图字节的
 * base64 投影（与上传同一取舍：复用 JSON 端口；生产换预签名 URL）。
 */
export const portraitPoseImageResponseSchema = z.object({
  contentType: z.string(),
  dataBase64: z.string(),
})

export type PortraitPoseImageResponse = z.infer<
  typeof portraitPoseImageResponseSchema
>

/**
 * POST /v1/portraits/generations 请求。photoKey 为已上传照片的对象存储引用
 * （本地/小规模走 POST /v1/portraits/photos；生产可换客户端直传/预签名 URL）。
 */
export const submitGenerationRequestSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  photoKey: z.string().min(1).max(512),
})

export type SubmitGenerationRequest = z.infer<
  typeof submitGenerationRequestSchema
>

/** POST（202 新建 / 200 幂等重放）与 GET /v1/portraits/generations/:jobId 响应。 */
export const generationJobResponseSchema = z.object({
  job: generationJobSchema,
})

export type GenerationJobResponse = z.infer<typeof generationJobResponseSchema>

/** 确认后产出的可用形象记录：只向未来生效，不重写已锁定 Trip 与已收藏 Postcard。 */
export const userPortraitSchema = z.object({
  id: z.uuid(),
  jobId: z.uuid(),
  poses: z.record(portraitPoseSchema, z.string()),
  createdAt: z.number(),
})

export type UserPortrait = z.infer<typeof userPortraitSchema>

/** GET /v1/portraits 响应：当前账号全部已确认形象（按创建时间升序）。 */
export const listPortraitsResponseSchema = z.object({
  portraits: z.array(userPortraitSchema),
})

export type ListPortraitsResponse = z.infer<typeof listPortraitsResponseSchema>

/** POST /v1/portraits/generations/:jobId/confirm 响应。 */
export const confirmGenerationResponseSchema = z.object({
  job: generationJobSchema,
  portrait: userPortraitSchema,
})

export type ConfirmGenerationResponse = z.infer<
  typeof confirmGenerationResponseSchema
>
