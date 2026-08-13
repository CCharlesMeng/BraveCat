import {
  portraitGenerationPoses,
  type GenerationFailureReason,
  type PortraitPose,
  type QaCheckResult,
} from '@bravecat/contracts'
import type {
  GenerationJobRecord,
  Repositories,
} from '../repositories/types.js'
import { jobReleaseKey } from './creditKeys.js'
import type {
  AssetStorage,
  GenerationProvider,
  ModerationProvider,
} from './ports.js'
import type { PortraitQa } from './qa.js'

export interface GenerationJobExecutorDeps {
  repositories: Pick<Repositories, 'generationJobs' | 'generationCredits'>
  storage: AssetStorage
  moderation: ModerationProvider
  generation: GenerationProvider
  qa: PortraitQa
  now: () => number
}

export interface GenerationJobExecutor {
  /** 把一个 pending job 推进到终态；非 pending 直接跳过（防重复执行）。 */
  execute(jobId: string): Promise<void>
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** 产出图的对象存储 key；确认后由形象记录引用同一批对象。 */
export const generationAssetKey = (jobId: string, pose: PortraitPose): string =>
  `portraits/generations/${jobId}/${pose}.png`

/**
 * 生成 job 状态机执行器：
 * pending → moderating（内容审核）→ generating（风格化 + 逐姿势生成 + 抠图）
 * → qa（自动 QA）→ awaiting_confirm；任一环节失败 → failed 并自动退回预扣次数。
 *
 * 失败原因三分：moderation_rejected（审核明确拒绝）/ generation_failed
 * （任一环节的 provider 故障或管线异常）/ qa_failed（自动 QA 不过）。
 * 不合格姿势的单独重试（spike 建议上限 2 次）留待接入真实 provider 后实现。
 */
export const createGenerationJobExecutor = (
  deps: GenerationJobExecutorDeps,
): GenerationJobExecutor => {
  const { generationJobs, generationCredits } = deps.repositories

  const advance = async (
    job: GenerationJobRecord,
    status: GenerationJobRecord['status'],
  ): Promise<void> => {
    job.status = status
    job.updatedAt = deps.now()
    await generationJobs.update(job)
  }

  const fail = async (
    job: GenerationJobRecord,
    reason: GenerationFailureReason,
    message: string,
    qa?: QaCheckResult[],
  ): Promise<void> => {
    job.status = 'failed'
    job.failure = qa ? { reason, message, qa } : { reason, message }
    job.updatedAt = deps.now()
    await generationJobs.update(job)
    // 失败自动退回提交时的预扣；release 幂等键保证重放也只退一次。
    await generationCredits.insertMany([
      {
        userId: job.userId,
        idempotencyKey: jobReleaseKey(job.id),
        kind: 'release',
        amount: 1,
        jobId: job.id,
        recordedAt: deps.now(),
      },
    ])
  }

  return {
    execute: async (jobId) => {
      const job = await generationJobs.findById(jobId)
      if (!job || job.status !== 'pending') {
        return
      }

      // ① 内容审核（上传照片含人脸/敏感内容必须拦截，合规义务）。
      await advance(job, 'moderating')
      const photo = await deps.storage.get(job.photoKey)
      if (!photo) {
        return fail(job, 'generation_failed', '上传照片引用已失效')
      }
      try {
        const verdict = await deps.moderation.moderateImage({
          key: job.photoKey,
          bytes: photo,
        })
        if (verdict.verdict === 'reject') {
          return fail(job, 'moderation_rejected', verdict.reason)
        }
      } catch (error) {
        return fail(
          job,
          'generation_failed',
          `内容审核服务异常：${errorMessage(error)}`,
        )
      }

      // ② 生成：风格化 → 逐姿势生成 → 抠图后处理（spike 管线建议 ②③④）。
      await advance(job, 'generating')
      const generated = new Map<PortraitPose, Uint8Array>()
      try {
        const character = await deps.generation.stylize({ photo })
        for (const pose of portraitGenerationPoses) {
          const raw = await deps.generation.generatePose({ character, pose })
          generated.set(pose, await deps.generation.removeBackground({ image: raw }))
        }
      } catch (error) {
        return fail(job, 'generation_failed', errorMessage(error))
      }

      // ③ 自动 QA：任一已实现检查项 fail 即整套不过（not_implemented 不拦截）。
      await advance(job, 'qa')
      const qaResults: QaCheckResult[] = []
      for (const pose of portraitGenerationPoses) {
        qaResults.push(
          ...(await deps.qa.evaluate({ pose, image: generated.get(pose)! })),
        )
      }
      const failedChecks = qaResults.filter((result) => result.status === 'fail')
      if (failedChecks.length > 0) {
        const summary = failedChecks
          .map((check) => `${check.pose}/${check.checkId}`)
          .join('、')
        return fail(job, 'qa_failed', `自动 QA 未通过：${summary}`, qaResults)
      }

      // ④ 产出图入对象存储，等待用户确认（「这是我的猫吗」确认页）。
      //    确认之前次数只是预扣，形象记录也尚未产生（ADR-0004 只向未来生效）。
      const poses = {} as Record<PortraitPose, string>
      for (const pose of portraitGenerationPoses) {
        const key = generationAssetKey(job.id, pose)
        await deps.storage.put(key, generated.get(pose)!, 'image/png')
        poses[pose] = key
      }
      job.result = { poses, qa: qaResults }
      await advance(job, 'awaiting_confirm')
    },
  }
}
