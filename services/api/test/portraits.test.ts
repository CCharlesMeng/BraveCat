import { describe, expect, it } from 'vitest'
import { ErrorCode, portraitGenerationPoses } from '@bravecat/contracts'
import {
  createFakeGenerationProvider,
  encodeSolidPng,
} from '../src/aigc/fakes.js'
import {
  bearer,
  createTestApp,
  redeemTestCredits,
  registerGuest,
} from './helpers.js'

const PHOTO_KEY = 'uploads/u1/photo.png'

type TestApp = ReturnType<typeof createTestApp>

/** 造一个已充值、已上传照片的账号。 */
const setupUser = async (test: TestApp, credits = 3) => {
  const guest = await registerGuest(test.app)
  if (credits > 0) {
    await redeemTestCredits(test.app, guest.token, credits)
  }
  await test.storage.put(
    PHOTO_KEY,
    encodeSolidPng(1024, 1024, { alpha: false }),
    'image/png',
  )
  return guest
}

const submit = async (
  test: TestApp,
  token: string,
  payload: Record<string, unknown> = {},
) =>
  test.app.inject({
    method: 'POST',
    url: '/v1/portraits/generations',
    headers: bearer(token),
    payload: { idempotencyKey: 'gen-1', photoKey: PHOTO_KEY, ...payload },
  })

const getJob = async (test: TestApp, token: string, jobId: string) => {
  const response = await test.app.inject({
    method: 'GET',
    url: `/v1/portraits/generations/${jobId}`,
    headers: bearer(token),
  })
  expect(response.statusCode).toBe(200)
  return response.json().job
}

const confirm = async (test: TestApp, token: string, jobId: string) =>
  test.app.inject({
    method: 'POST',
    url: `/v1/portraits/generations/${jobId}/confirm`,
    headers: bearer(token),
  })

const balanceOf = async (test: TestApp, token: string) => {
  const response = await test.app.inject({
    method: 'GET',
    url: '/v1/credits/balance',
    headers: bearer(token),
  })
  return (response.json() as { balance: number }).balance
}

describe('POST /v1/portraits/generations', () => {
  it('余额不足直接拒绝，不创建 job', async () => {
    const test = createTestApp()
    const guest = await setupUser(test, 0)

    const response = await submit(test, guest.token)

    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe(ErrorCode.CreditInsufficientBalance)
    // 幂等键未被占用（重放同键充值后可正常提交）。
    await redeemTestCredits(test.app, guest.token, 1)
    expect((await submit(test, guest.token)).statusCode).toBe(202)
  })

  it('照片上传引用不存在 → 422 UPLOAD_NOT_FOUND', async () => {
    const test = createTestApp()
    const guest = await setupUser(test)

    const response = await submit(test, guest.token, {
      photoKey: 'uploads/u1/nonexistent.png',
    })

    expect(response.statusCode).toBe(422)
    expect(response.json().error.code).toBe(ErrorCode.UploadNotFound)
    expect(await balanceOf(test, guest.token)).toBe(3)
  })

  it('提交预扣一次并异步推进到 awaiting_confirm，产出全部 10 姿势', async () => {
    const test = createTestApp()
    const guest = await setupUser(test)

    const response = await submit(test, guest.token)
    expect(response.statusCode).toBe(202)
    expect(response.json().job.status).toBe('pending')
    // 提交即预扣（hold），此时尚未正式消耗。
    expect(await balanceOf(test, guest.token)).toBe(2)

    await test.queue.onIdle()
    const job = await getJob(test, guest.token, response.json().job.id)
    expect(job.status).toBe('awaiting_confirm')
    expect(Object.keys(job.result.poses).sort()).toEqual(
      [...portraitGenerationPoses].sort(),
    )
    // 产出图确实写入了对象存储。
    for (const key of Object.values(job.result.poses)) {
      expect(await test.storage.exists(key as string)).toBe(true)
    }
    // QA 报告包含规格类通过项与语义类 not_implemented 检查位。
    const statuses = new Set(
      (job.result.qa as { status: string }[]).map((check) => check.status),
    )
    expect(statuses).toEqual(new Set(['pass', 'not_implemented']))
  })

  it('提交幂等：同键重放返回同一 job，只预扣一次', async () => {
    const test = createTestApp()
    const guest = await setupUser(test)

    const first = await submit(test, guest.token)
    await test.queue.onIdle()
    const replay = await submit(test, guest.token)

    expect(replay.statusCode).toBe(200)
    expect(replay.json().job.id).toBe(first.json().job.id)
    expect(await balanceOf(test, guest.token)).toBe(2)
  })
})

describe('生成 job 失败路径（均自动退回预扣次数）', () => {
  it('审核拒绝 → moderation_rejected，次数退回', async () => {
    const test = createTestApp({
      moderation: {
        moderateImage: async () => ({
          verdict: 'reject',
          reason: '照片包含违规内容',
        }),
      },
    })
    const guest = await setupUser(test)

    const response = await submit(test, guest.token)
    await test.queue.onIdle()

    const job = await getJob(test, guest.token, response.json().job.id)
    expect(job.status).toBe('failed')
    expect(job.failure.reason).toBe('moderation_rejected')
    expect(job.failure.message).toContain('违规')
    expect(await balanceOf(test, guest.token)).toBe(3)
  })

  it('生成服务抛错 → generation_failed，次数退回', async () => {
    const test = createTestApp({
      generation: {
        stylize: async () => {
          throw new Error('万相服务 500')
        },
        generatePose: async () => {
          throw new Error('unreachable')
        },
        removeBackground: async () => {
          throw new Error('unreachable')
        },
      },
    })
    const guest = await setupUser(test)

    const response = await submit(test, guest.token)
    await test.queue.onIdle()

    const job = await getJob(test, guest.token, response.json().job.id)
    expect(job.status).toBe('failed')
    expect(job.failure.reason).toBe('generation_failed')
    expect(await balanceOf(test, guest.token)).toBe(3)
  })

  it('自动 QA 不过 → qa_failed，附检查报告，次数退回', async () => {
    const test = createTestApp({
      // 出图尺寸 512×512，不符合 1024×1024 规格。
      generation: createFakeGenerationProvider({
        generatePose: () => encodeSolidPng(512, 512, { alpha: false }),
      }),
    })
    const guest = await setupUser(test)

    const response = await submit(test, guest.token)
    await test.queue.onIdle()

    const job = await getJob(test, guest.token, response.json().job.id)
    expect(job.status).toBe('failed')
    expect(job.failure.reason).toBe('qa_failed')
    expect(
      (job.failure.qa as { checkId: string; status: string }[]).some(
        (check) => check.checkId === 'spec-dimensions' && check.status === 'fail',
      ),
    ).toBe(true)
    expect(await balanceOf(test, guest.token)).toBe(3)
  })
})

describe('POST /v1/portraits/generations/:jobId/confirm', () => {
  it('确认时才落定消耗并产出形象记录（ADR-0004 只向未来生效）', async () => {
    const test = createTestApp()
    const guest = await setupUser(test)
    const jobId = (await submit(test, guest.token)).json().job.id
    await test.queue.onIdle()

    // 确认前：只有预扣（hold），没有正式消耗，也没有形象记录。
    const entriesBefore = await test.repositories.generationCredits.listByUser(
      guest.userId,
    )
    expect(entriesBefore.map((entry) => entry.kind)).toEqual([
      'purchase',
      'hold',
    ])
    expect(
      await test.repositories.userPortraits.findByJobId(jobId),
    ).toBeUndefined()

    const response = await confirm(test, guest.token, jobId)
    expect(response.statusCode).toBe(200)
    const { job, portrait } = response.json()
    expect(job.status).toBe('confirmed')
    expect(job.portraitId).toBe(portrait.id)
    expect(Object.keys(portrait.poses)).toHaveLength(10)

    // 确认后：预扣释放 + 正式消耗成对入账，净余额不变（2）。
    const entriesAfter = await test.repositories.generationCredits.listByUser(
      guest.userId,
    )
    expect(entriesAfter.map((entry) => entry.kind)).toEqual([
      'purchase',
      'hold',
      'release',
      'consume',
    ])
    expect(await balanceOf(test, guest.token)).toBe(2)
  })

  it('确认幂等：重复确认返回同一形象记录，不重复记账', async () => {
    const test = createTestApp()
    const guest = await setupUser(test)
    const jobId = (await submit(test, guest.token)).json().job.id
    await test.queue.onIdle()

    const first = await confirm(test, guest.token, jobId)
    const replay = await confirm(test, guest.token, jobId)

    expect(replay.statusCode).toBe(200)
    expect(replay.json().portrait.id).toBe(first.json().portrait.id)
    const entries = await test.repositories.generationCredits.listByUser(
      guest.userId,
    )
    expect(entries).toHaveLength(4) // purchase + hold + release + consume
    expect(await balanceOf(test, guest.token)).toBe(2)
  })

  it('失败的 job 不可确认 → 409', async () => {
    const test = createTestApp({
      moderation: {
        moderateImage: async () => ({ verdict: 'reject', reason: '拒绝' }),
      },
    })
    const guest = await setupUser(test)
    const jobId = (await submit(test, guest.token)).json().job.id
    await test.queue.onIdle()

    const response = await confirm(test, guest.token, jobId)

    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe(
      ErrorCode.GenerationJobNotConfirmable,
    )
    // 失败已退回，确认失败不再改变余额。
    expect(await balanceOf(test, guest.token)).toBe(3)
  })
})

describe('GET /v1/portraits/generations/:jobId', () => {
  it('他人 job 与不存在的 job 统一 404', async () => {
    const test = createTestApp()
    const owner = await setupUser(test)
    const jobId = (await submit(test, owner.token)).json().job.id
    await test.queue.onIdle()

    const stranger = await registerGuest(test.app)
    const strangerResponse = await test.app.inject({
      method: 'GET',
      url: `/v1/portraits/generations/${jobId}`,
      headers: bearer(stranger.token),
    })
    expect(strangerResponse.statusCode).toBe(404)

    const missingResponse = await test.app.inject({
      method: 'GET',
      url: '/v1/portraits/generations/00000000-0000-4000-8000-000000000000',
      headers: bearer(owner.token),
    })
    expect(missingResponse.statusCode).toBe(404)
  })
})
