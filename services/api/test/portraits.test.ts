import { describe, expect, it } from 'vitest'
import {
  ErrorCode,
  MAX_PORTRAIT_PHOTO_BYTES,
  portraitGenerationPoses,
} from '@bravecat/contracts'
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

describe('POST /v1/portraits/photos', () => {
  const uploadPhoto = async (
    test: TestApp,
    token: string,
    payload: Record<string, unknown>,
  ) =>
    test.app.inject({
      method: 'POST',
      url: '/v1/portraits/photos',
      headers: bearer(token),
      payload,
    })

  it('PNG 上传落进对象存储并返回 photoKey', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    const photo = encodeSolidPng(1024, 1024, { alpha: false })

    const response = await uploadPhoto(test, guest.token, {
      contentType: 'image/png',
      dataBase64: Buffer.from(photo).toString('base64'),
    })

    expect(response.statusCode).toBe(201)
    const { photoKey } = response.json() as { photoKey: string }
    expect(photoKey).toMatch(
      new RegExp(`^portraits/uploads/${guest.userId}/[0-9a-f-]+\\.png$`),
    )
    expect(await test.storage.get(photoKey)).toEqual(photo)
  })

  it('上传的 photoKey 可直接提交生成并走完管线', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)
    await redeemTestCredits(test.app, guest.token, 1)
    const upload = await uploadPhoto(test, guest.token, {
      contentType: 'image/jpeg',
      dataBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString(
        'base64',
      ),
    })
    expect(upload.statusCode).toBe(201)

    const submitted = await submit(test, guest.token, {
      photoKey: (upload.json() as { photoKey: string }).photoKey,
    })
    expect(submitted.statusCode).toBe(202)
    await test.queue.onIdle()
    const job = await getJob(test, guest.token, submitted.json().job.id)
    expect(job.status).toBe('awaiting_confirm')
  })

  it('拒绝魔数与声明格式不符的照片', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)

    const response = await uploadPhoto(test, guest.token, {
      contentType: 'image/png',
      dataBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64'),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe(ErrorCode.ValidationFailed)
  })

  it('拒绝非法 base64 与超限照片', async () => {
    const test = createTestApp()
    const guest = await registerGuest(test.app)

    const badBase64 = await uploadPhoto(test, guest.token, {
      contentType: 'image/png',
      dataBase64: '!!!not-base64!!!',
    })
    expect(badBase64.statusCode).toBe(400)

    const oversized = Buffer.alloc(MAX_PORTRAIT_PHOTO_BYTES + 1)
    oversized.set([0xff, 0xd8, 0xff])
    const tooLarge = await uploadPhoto(test, guest.token, {
      contentType: 'image/jpeg',
      dataBase64: oversized.toString('base64'),
    })
    expect(tooLarge.statusCode).toBe(400)
    expect(tooLarge.json().error.message).toContain('上限')
  })

  it('未认证请求被拒绝', async () => {
    const test = createTestApp()

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/portraits/photos',
      payload: { contentType: 'image/png', dataBase64: 'aGVsbG8=' },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /v1/portraits/generations/:jobId/poses/:pose', () => {
  const getPoseImage = async (
    test: TestApp,
    token: string,
    jobId: string,
    pose: string,
  ) =>
    test.app.inject({
      method: 'GET',
      url: `/v1/portraits/generations/${jobId}/poses/${pose}`,
      headers: bearer(token),
    })

  it('返回产出图的 base64，解码后与对象存储一致', async () => {
    const test = createTestApp()
    const guest = await setupUser(test)
    const jobId = (await submit(test, guest.token)).json().job.id
    await test.queue.onIdle()
    const job = await getJob(test, guest.token, jobId)

    const response = await getPoseImage(test, guest.token, jobId, 'sit')

    expect(response.statusCode).toBe(200)
    const body = response.json() as { contentType: string; dataBase64: string }
    expect(body.contentType).toBe('image/png')
    expect(new Uint8Array(Buffer.from(body.dataBase64, 'base64'))).toEqual(
      await test.storage.get(job.result.poses.sit),
    )
  })

  it('未知姿势、无产出的失败 job 与他人 job 统一 404', async () => {
    const test = createTestApp({
      moderation: {
        moderateImage: async () => ({ verdict: 'reject', reason: '拒绝' }),
      },
    })
    const guest = await setupUser(test)
    const jobId = (await submit(test, guest.token)).json().job.id
    await test.queue.onIdle()

    expect((await getPoseImage(test, guest.token, jobId, 'dance')).statusCode)
      .toBe(404)
    // 审核拒绝的 job 没有 result。
    expect((await getPoseImage(test, guest.token, jobId, 'sit')).statusCode)
      .toBe(404)
    const stranger = await registerGuest(test.app)
    expect((await getPoseImage(test, stranger.token, jobId, 'sit')).statusCode)
      .toBe(404)
  })
})

describe('GET /v1/portraits', () => {
  const listPortraits = async (test: TestApp, token: string) => {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/portraits',
      headers: bearer(token),
    })
    expect(response.statusCode).toBe(200)
    return (response.json() as { portraits: Record<string, unknown>[] })
      .portraits
  }

  it('确认前为空，确认后只返回自己的形象记录', async () => {
    const test = createTestApp()
    const guest = await setupUser(test)
    expect(await listPortraits(test, guest.token)).toEqual([])

    const jobId = (await submit(test, guest.token)).json().job.id
    await test.queue.onIdle()
    const confirmed = await confirm(test, guest.token, jobId)
    expect(confirmed.statusCode).toBe(200)

    const portraits = await listPortraits(test, guest.token)
    expect(portraits).toHaveLength(1)
    expect(portraits[0].id).toBe(confirmed.json().portrait.id)
    expect(portraits[0].jobId).toBe(jobId)
    expect(Object.keys(portraits[0].poses as object)).toHaveLength(10)
    // 存储侧的归属字段不进 API 投影。
    expect(portraits[0].userId).toBeUndefined()

    const stranger = await registerGuest(test.app)
    expect(await listPortraits(test, stranger.token)).toEqual([])
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
