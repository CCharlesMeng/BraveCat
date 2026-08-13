import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import {
  ErrorCode,
  MAX_PORTRAIT_PHOTO_BYTES,
  portraitPoseSchema,
  submitGenerationRequestSchema,
  uploadPortraitPhotoRequestSchema,
  type ConfirmGenerationResponse,
  type GenerationJob,
  type GenerationJobResponse,
  type ListPortraitsResponse,
  type PortraitPhotoContentType,
  type PortraitPoseImageResponse,
  type UploadPortraitPhotoResponse,
  type UserPortrait,
} from '@bravecat/contracts'
import {
  jobConsumeKey,
  jobHoldKey,
  jobReleaseKey,
} from '../aigc/creditKeys.js'
import { parsePngHeader } from '../aigc/png.js'
import { sendError, sendValidationError } from '../http/replies.js'
import type {
  GenerationJobRecord,
  UserPortraitRecord,
} from '../repositories/types.js'
import type { RouteDeps } from './deps.js'

const toApiJob = (record: GenerationJobRecord): GenerationJob => {
  const { userId: _userId, idempotencyKey: _idempotencyKey, ...job } = record
  return job
}

const toApiPortrait = (record: UserPortraitRecord): UserPortrait => {
  const { userId: _userId, ...portrait } = record
  return portrait
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/

/** Buffer.from 对非法字符过于宽容，先做字符集与长度校验再解码。 */
const decodeBase64Strict = (text: string): Uint8Array | undefined => {
  if (text.length % 4 !== 0 || !BASE64_PATTERN.test(text)) {
    return undefined
  }
  return new Uint8Array(Buffer.from(text, 'base64'))
}

/** 魔数校验：不信任客户端声明的 contentType。 */
const matchesContentType = (
  bytes: Uint8Array,
  contentType: PortraitPhotoContentType,
): boolean =>
  contentType === 'image/png'
    ? parsePngHeader(bytes) !== undefined
    : bytes.length > 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff

const photoExtension = (contentType: PortraitPhotoContentType): string =>
  contentType === 'image/png' ? 'png' : 'jpg'

/**
 * AIGC 形象生成 job 管线（次数事务语义见 repositories/types.ts 的
 * GenerationCreditRepository 注释）：
 * - POST   /portraits/photos                最小照片上传（JSON + base64）
 * - POST   /portraits/generations           提交（校验照片引用与余额，预扣 1 次）
 * - GET    /portraits/generations/:jobId    查询状态
 * - GET    /portraits/generations/:jobId/poses/:pose  读取产出图（base64）
 * - POST   /portraits/generations/:jobId/confirm  确认（落定消耗，产出形象记录）
 * - GET    /portraits                       已确认形象列表
 */
export const registerPortraitRoutes = (
  app: FastifyInstance,
  deps: RouteDeps,
): void => {
  const { generationCredits, generationJobs, userPortraits } = deps.repositories

  /**
   * 最小照片上传端点：JSON + base64 落进 AssetStorage 端口，返回 photoKey。
   * 走 JSON 是为了复用现有 5MB bodyLimit 与客户端字符串体 HTTP 端口；
   * 生产接入 OSS 后可换预签名 URL 直传，本端点与响应类型随之退役。
   */
  app.post(
    '/portraits/photos',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const parsed = uploadPortraitPhotoRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error)
      }
      const { contentType, dataBase64 } = parsed.data

      const bytes = decodeBase64Strict(dataBase64)
      if (!bytes || bytes.length === 0) {
        return sendError(
          reply,
          400,
          ErrorCode.ValidationFailed,
          '照片数据不是合法的 base64',
        )
      }
      if (bytes.length > MAX_PORTRAIT_PHOTO_BYTES) {
        return sendError(
          reply,
          400,
          ErrorCode.ValidationFailed,
          `照片超过大小上限（${MAX_PORTRAIT_PHOTO_BYTES} 字节）`,
        )
      }
      if (!matchesContentType(bytes, contentType)) {
        return sendError(
          reply,
          400,
          ErrorCode.ValidationFailed,
          `照片内容与声明的格式不符：${contentType}`,
        )
      }

      const photoKey =
        `portraits/uploads/${request.userId}/` +
        `${randomUUID()}.${photoExtension(contentType)}`
      await deps.aigc.storage.put(photoKey, bytes, contentType)

      const body: UploadPortraitPhotoResponse = { photoKey }
      return reply.status(201).send(body)
    },
  )

  /** 当前账号全部已确认形象（跨会话恢复可选列表用）。 */
  app.get(
    '/portraits',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const portraits = await userPortraits.listByUser(request.userId)
      const body: ListPortraitsResponse = {
        portraits: portraits.map(toApiPortrait),
      }
      return reply.send(body)
    },
  )

  app.post(
    '/portraits/generations',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const parsed = submitGenerationRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error)
      }
      const { idempotencyKey, photoKey } = parsed.data

      // 提交幂等：同键重放返回既有 job，不重复预扣、不重复入队。
      const existing = await generationJobs.findByIdempotencyKey(
        request.userId,
        idempotencyKey,
      )
      if (existing) {
        const body: GenerationJobResponse = { job: toApiJob(existing) }
        return reply.status(200).send(body)
      }

      // 照片上传引用必须已在对象存储中（上传走客户端直传/预签名 URL）。
      if (!(await deps.aigc.storage.exists(photoKey))) {
        return sendError(
          reply,
          422,
          ErrorCode.UploadNotFound,
          `照片上传引用不存在：${photoKey}`,
        )
      }

      const balance = await generationCredits.getBalance(request.userId)
      if (balance < 1) {
        return sendError(
          reply,
          422,
          ErrorCode.CreditInsufficientBalance,
          `生成次数不足：当前余额 ${balance}`,
        )
      }

      // 预扣 1 次（hold）：失败由执行器自动退回，确认时落定为正式消耗。
      const jobId = randomUUID()
      await generationCredits.insertMany([
        {
          userId: request.userId,
          idempotencyKey: jobHoldKey(jobId),
          kind: 'hold',
          amount: -1,
          jobId,
          recordedAt: deps.now(),
        },
      ])
      // 并发兜底：预扣后余额为负说明与其他提交抢占了同一次数，补偿释放并拒绝。
      if ((await generationCredits.getBalance(request.userId)) < 0) {
        await generationCredits.insertMany([
          {
            userId: request.userId,
            idempotencyKey: jobReleaseKey(jobId),
            kind: 'release',
            amount: 1,
            jobId,
            recordedAt: deps.now(),
          },
        ])
        return sendError(
          reply,
          422,
          ErrorCode.CreditInsufficientBalance,
          '生成次数不足：余额已被并发提交占用',
        )
      }

      const now = deps.now()
      const job: GenerationJobRecord = {
        id: jobId,
        userId: request.userId,
        idempotencyKey,
        photoKey,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }
      await generationJobs.create(job)
      deps.aigc.queue.enqueue(jobId)

      const body: GenerationJobResponse = { job: toApiJob(job) }
      return reply.status(202).send(body)
    },
  )

  app.get(
    '/portraits/generations/:jobId',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string }
      const job = await generationJobs.findById(jobId)
      // 他人 job 与不存在的 job 统一 404，不泄露存在性。
      if (!job || job.userId !== request.userId) {
        return sendError(reply, 404, ErrorCode.NotFound, '生成任务不存在')
      }
      const body: GenerationJobResponse = { job: toApiJob(job) }
      return reply.send(body)
    },
  )

  /**
   * 读取产出图（确认页预览与已确认形象渲染共用；形象记录引用同一批对象）。
   * base64 投影的取舍同上传端点：生产换 OSS 预签名 URL / CDN。
   */
  app.get(
    '/portraits/generations/:jobId/poses/:pose',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const { jobId, pose } = request.params as { jobId: string; pose: string }
      const job = await generationJobs.findById(jobId)
      if (!job || job.userId !== request.userId) {
        return sendError(reply, 404, ErrorCode.NotFound, '生成任务不存在')
      }
      const parsedPose = portraitPoseSchema.safeParse(pose)
      const key = parsedPose.success
        ? job.result?.poses[parsedPose.data]
        : undefined
      const bytes = key ? await deps.aigc.storage.get(key) : undefined
      if (!bytes) {
        return sendError(reply, 404, ErrorCode.NotFound, '生成产出图不存在')
      }
      const body: PortraitPoseImageResponse = {
        contentType: 'image/png',
        dataBase64: Buffer.from(bytes).toString('base64'),
      }
      return reply.send(body)
    },
  )

  /**
   * 用户确认（「这是我的猫吗」）：此刻才落定消耗并产出可用形象记录。
   * 形象记录只向未来生效（ADR-0004）：尚未出发的 Cat 在生成旅行计划时读取
   * 最新 Portrait，已锁定 Trip 与已收藏 Postcard 不受影响——服务端只新增记录，
   * 不改写任何历史数据，天然满足该语义。
   */
  app.post(
    '/portraits/generations/:jobId/confirm',
    { preHandler: [deps.authenticate] },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string }
      const job = await generationJobs.findById(jobId)
      if (!job || job.userId !== request.userId) {
        return sendError(reply, 404, ErrorCode.NotFound, '生成任务不存在')
      }

      if (job.status === 'confirmed') {
        // 确认幂等：重放返回已产出的形象记录。
        const portrait = await userPortraits.findByJobId(job.id)
        if (!portrait) {
          return sendError(reply, 500, ErrorCode.Internal, '形象记录缺失')
        }
        const body: ConfirmGenerationResponse = {
          job: toApiJob(job),
          portrait: toApiPortrait(portrait),
        }
        return reply.send(body)
      }

      if (job.status !== 'awaiting_confirm' || !job.result) {
        return sendError(
          reply,
          409,
          ErrorCode.GenerationJobNotConfirmable,
          `job 当前状态为 ${job.status}，只有 awaiting_confirm 可确认`,
        )
      }

      // 结算：释放预扣并落定正式消耗（净额不变；consume 记录自此不可逆）。
      // 两笔幂等键唯一，请求重放或中途崩溃后重试都不会重复记账。
      const now = deps.now()
      await generationCredits.insertMany([
        {
          userId: request.userId,
          idempotencyKey: jobReleaseKey(job.id),
          kind: 'release',
          amount: 1,
          jobId: job.id,
          recordedAt: now,
        },
        {
          userId: request.userId,
          idempotencyKey: jobConsumeKey(job.id),
          kind: 'consume',
          amount: -1,
          jobId: job.id,
          recordedAt: now,
        },
      ])

      const existingPortrait = await userPortraits.findByJobId(job.id)
      const portrait: UserPortraitRecord = existingPortrait ?? {
        id: randomUUID(),
        userId: request.userId,
        jobId: job.id,
        poses: job.result.poses,
        createdAt: now,
      }
      if (!existingPortrait) {
        await userPortraits.insert(portrait)
      }

      job.status = 'confirmed'
      job.portraitId = portrait.id
      job.updatedAt = now
      await generationJobs.update(job)

      const body: ConfirmGenerationResponse = {
        job: toApiJob(job),
        portrait: toApiPortrait(portrait),
      }
      return reply.send(body)
    },
  )
}
