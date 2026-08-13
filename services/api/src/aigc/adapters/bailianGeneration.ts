import { setTimeout as sleep } from 'node:timers/promises'
import type { PortraitPose } from '@bravecat/contracts'
import type { GenerationProvider, StylizedCharacter } from '../ports.js'
import { signAliyunRpcParams } from './aliyunSignature.js'

/**
 * 阿里云百炼（DashScope）生成 adapter，按 spike 管线建议组织三步调用结构：
 *
 * ② stylize：qwen-vl 从用户照片提取特征锁定文字（花色分块/眼色/体型逐条锁定）；
 * ③ generatePose：万相（wan2.7-image-pro / wan2.7-image）多图参考——
 *    用户照片 + 现役姿势锚图（画风与构图参考）+ 特征文字，
 *    中性浅灰绿底（#E8EDE8）出图，避免浅色猫贴白底抠不净；
 * ④ removeBackground：VIAPI 通用分割（SegmentCommonImage）返回四通道 PNG，
 *    禁用阈值法抠图（spike 实测边缘近白像素占比 38%–66%）。
 *
 * 未与真实服务联调；上线前第一优先事项是按 feasibility.md 条件 A
 * 用同一张照片替身跑 10 姿势打样验证真实一致性。
 * 逐姿势失败重试（上限 2 次）与 2K 生成→1024 降采样在打样后接入。
 */

/** 姿势词汇（packages/core portraitPoseVocabulary）的自然语言转写，进入提示词。 */
const POSE_PROMPTS: Record<PortraitPose, string> = {
  sit: '紧凑坐姿，臀部与双前爪着地于同一水平面',
  sleep: '蜷成一团熟睡，躯干、头与蜷起的爪贴地',
  walk: '完全侧面的行进姿态，承重爪落在同一条水平地线上',
  eat: '四爪站立低头进食，食盆画入形象内、位于口鼻下前方',
  play: '后爪与一只撑地前爪承重，另一只前爪拨弄画入形象内的小玩具',
  gaze: '坐姿远眺，臀部与爪着地，视线沿头眼方向延伸（不要画出远景目标）',
  sniff: '站立嗅闻，鼻尖向前下方探出（不要画出气味来源）',
  reach: '后爪与一只撑地前爪承重，另一只前爪向前上方伸出（不要画出触及目标）',
  stretch: '前爪前伸、后臀抬起的伸展姿势，前后爪贴地',
  greet: '坐姿抬起一只前爪打招呼（不要画出互动对象）',
}

const COMMON_PROMPT =
  '彩铅写实质感、细腻毛发笔触、柔和暖光、无描边；' +
  '纯净的中性浅灰绿背景（#E8EDE8）、无地面阴影；' +
  '主体贴近画面底部居中（对应锚点约定 support-contact-bottom-center）'

export interface BailianGenerationConfig {
  apiKey: string
  /** DashScope API 基址。 */
  baseUrl?: string
  /** 特征提取视觉模型。 */
  visionModel?: string
  /** 出图模型：wan2.7-image-pro（旗舰 0.5 元/张）/ wan2.7-image（≈0.21 元/张）。 */
  imageModel?: string
  /** 现役姿势锚图（如 CDN 上的 minho 组）URL，画风与构图参考。 */
  poseAnchorUrl: (pose: PortraitPose) => string
  /**
   * VIAPI 通用分割（抠图）配置。分割接口只收图片 URL，
   * publishImage 需把中间产物发布为可访问 URL（同地域 OSS）；
   * 注意 VIAPI 输入最长边 ≤1999px，2K 出图需先缩边。
   */
  segmentation?: {
    accessKeyId: string
    accessKeySecret: string
    endpoint: string
    publishImage: (bytes: Uint8Array) => Promise<string>
  }
}

export const createBailianGenerationProviderFromEnv = (
  env: NodeJS.ProcessEnv,
): GenerationProvider | undefined => {
  const apiKey = env.DASHSCOPE_API_KEY
  const anchorBaseUrl = env.GENERATION_POSE_ANCHOR_BASE_URL
  if (!apiKey || !anchorBaseUrl) {
    return undefined
  }
  return createBailianGenerationProvider({
    apiKey,
    imageModel: env.GENERATION_IMAGE_MODEL,
    visionModel: env.GENERATION_VISION_MODEL,
    poseAnchorUrl: (pose) =>
      `${anchorBaseUrl.replace(/\/+$/, '')}/portrait--minho--${pose}--v01.png`,
    // 分割配置依赖 OSS 中转发布，与存储 adapter 一起在联调阶段接线。
  })
}

interface DashScopeTaskResponse {
  output?: {
    task_id?: string
    task_status?: string
    text?: string
    choices?: { message?: { content?: { text?: string }[] } }[]
    results?: { url?: string }[]
  }
  message?: string
}

export const createBailianGenerationProvider = (
  config: BailianGenerationConfig,
): GenerationProvider => {
  const baseUrl = config.baseUrl ?? 'https://dashscope.aliyuncs.com/api/v1'
  const imageModel = config.imageModel ?? 'wan2.7-image-pro'
  const visionModel = config.visionModel ?? 'qwen-vl-max'

  const dashScopeHeaders = (async_?: boolean): Record<string, string> => ({
    authorization: `Bearer ${config.apiKey}`,
    'content-type': 'application/json',
    ...(async_ ? { 'x-dashscope-async': 'enable' } : {}),
  })

  const postJson = async (
    path: string,
    body: unknown,
    async_?: boolean,
  ): Promise<DashScopeTaskResponse> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: dashScopeHeaders(async_),
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`DashScope HTTP ${response.status}：${await response.text()}`)
    }
    return (await response.json()) as DashScopeTaskResponse
  }

  /** 异步出图任务轮询（万相出图为异步任务模型）。 */
  const pollTask = async (taskId: string): Promise<DashScopeTaskResponse> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(5_000)
      const response = await fetch(`${baseUrl}/tasks/${taskId}`, {
        headers: { authorization: `Bearer ${config.apiKey}` },
      })
      if (!response.ok) {
        throw new Error(`DashScope 任务查询 HTTP ${response.status}`)
      }
      const body = (await response.json()) as DashScopeTaskResponse
      const status = body.output?.task_status
      if (status === 'SUCCEEDED') {
        return body
      }
      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`DashScope 任务失败：${status} ${body.message ?? ''}`)
      }
    }
    throw new Error('DashScope 任务超时（5 分钟未完成）')
  }

  const downloadImage = async (url: string): Promise<Uint8Array> => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`产出图下载失败 HTTP ${response.status}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }

  const toDataUrl = (bytes: Uint8Array): string =>
    `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`

  return {
    // ② 特征提取：qwen-vl 描述花色分块/眼色/体型，生成特征锁定文字。
    stylize: async ({ photo }): Promise<StylizedCharacter> => {
      const body = await postJson('/services/aigc/multimodal-generation/generation', {
        model: visionModel,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: toDataUrl(photo) },
                {
                  text:
                    '这是用户的猫的照片。请逐条描述可锁定其身份的外观特征：' +
                    '花色分块（各色块的位置与边界）、眼睛颜色、鼻色、体型与尾巴纹路。' +
                    '输出为可直接拼入图像生成提示词的中文特征清单。',
                },
              ],
            },
          ],
        },
      })
      const featureLock =
        body.output?.choices?.[0]?.message?.content?.[0]?.text ??
        body.output?.text
      if (!featureLock) {
        throw new Error('qwen-vl 未返回特征描述')
      }
      return { featureLock, referenceImage: photo }
    },

    // ③ 逐姿势生成：双参考图（用户照片 + 现役姿势锚图）+ 特征锁定文字。
    generatePose: async ({ character, pose }) => {
      const submit = await postJson(
        '/services/aigc/text2image/image-synthesis',
        {
          model: imageModel,
          input: {
            prompt: `${character.featureLock}\n姿势要求：${POSE_PROMPTS[pose]}。\n${COMMON_PROMPT}`,
            // 参考图 1 = 用户照片（身份来源）；参考图 2 = 现役姿势锚图（画风与构图）。
            ref_images: [
              toDataUrl(character.referenceImage),
              config.poseAnchorUrl(pose),
            ],
          },
          // 2K 出图改善边缘，规格归一化（降采样 1024）在后处理做。
          parameters: { size: '2048*2048', n: 1 },
        },
        true,
      )
      const taskId = submit.output?.task_id
      if (!taskId) {
        throw new Error('DashScope 未返回 task_id')
      }
      const result = await pollTask(taskId)
      const url = result.output?.results?.[0]?.url
      if (!url) {
        throw new Error('DashScope 任务成功但无产出图 URL')
      }
      return downloadImage(url)
    },

    // ④ 抠图后处理：VIAPI 通用分割直接返回四通道 PNG。
    removeBackground: async ({ image }) => {
      const segmentation = config.segmentation
      if (!segmentation) {
        throw new Error(
          '分割服务未配置：removeBackground 需要 VIAPI 凭证与 publishImage 中转（见 BailianGenerationConfig.segmentation）',
        )
      }
      const imageUrl = await segmentation.publishImage(image)
      const query = signAliyunRpcParams({
        method: 'POST',
        accessKeyId: segmentation.accessKeyId,
        accessKeySecret: segmentation.accessKeySecret,
        params: {
          Action: 'SegmentCommonImage',
          Version: '2019-12-30',
          // 不传 ReturnForm：缺省即返回四通道透明背景 PNG。
          ImageURL: imageUrl,
        },
      })
      const response = await fetch(`https://${segmentation.endpoint}/`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: query.toString(),
      })
      if (!response.ok) {
        throw new Error(`VIAPI 分割接口 HTTP ${response.status}`)
      }
      const body = (await response.json()) as {
        Data?: { ImageURL?: string }
        Message?: string
      }
      const resultUrl = body.Data?.ImageURL
      if (!resultUrl) {
        throw new Error(`VIAPI 分割失败：${body.Message ?? '无产出 URL'}`)
      }
      return downloadImage(resultUrl)
    },
  }
}
