import type { PortraitPose, QaCheckId, QaCheckResult } from '@bravecat/contracts'
import { parsePngHeader, pngHasAlpha } from './png.js'

export interface PortraitQaInput {
  pose: PortraitPose
  /** 抠图后处理完成的最终产出图字节。 */
  image: Uint8Array
}

/** 逐姿势产出图的自动 QA 端口。 */
export interface PortraitQa {
  evaluate(input: PortraitQaInput): Promise<QaCheckResult[]>
}

/** 与现役 public/portraits 资产一致的规格（1024×1024 RGBA PNG）。 */
export const DEFAULT_PORTRAIT_SPEC = { width: 1024, height: 1024 } as const

/**
 * 图像语义类检查位：依赖像素级解码或视觉模型（qwen-vl），当前只登记不拦截
 * （status=not_implemented）。接入顺序与判定方法见 spike 可行性文档的自动 QA 表
 * （docs/art/candidates/aigc-portrait-spike-2026-08-13/feasibility.md）。
 */
const SEMANTIC_CHECKS: readonly { checkId: QaCheckId; message: string }[] = [
  {
    checkId: 'anchor-bottom-center',
    message:
      '待实现：按姿势词汇锚点 support-contact-bottom-center 校验 alpha 包围盒' +
      '水平居中与底距公差（样张实测底部留白 70–248px，需后处理基线重锚定）',
  },
  {
    checkId: 'single-subject',
    message: '待实现：检测框计数，有且仅有一只猫',
  },
  {
    checkId: 'pose-support-contacts',
    message: '待实现：落脚面与承重点符合姿势词汇定义（姿势分类/关键点）',
  },
  {
    checkId: 'interaction-target',
    message:
      '待实现：eat/play 的 portrait-contained 目标必须画入形象内；' +
      'gaze/sniff/reach/greet 的 scene-provided 目标不得烘入（视觉模型问答）',
  },
  {
    checkId: 'palette-consistency',
    message:
      '待实现：与基准 sit 图比较前景色直方图与色块拓扑' +
      '（样张实测漂移 ΔRGB≈(7,18,32)，阈值需打样标定）',
  },
  {
    checkId: 'alpha-quality',
    message: '待实现：连通域与边缘扫描，无孤岛/半透明噪点/同色光晕',
  },
]

/**
 * 基线自动 QA：实现明确可机判的规格类检查（PNG 格式 / 尺寸 / alpha 通道），
 * 语义类检查位登记为 not_implemented（不拦截）。任一实现项 fail 即 QA 不过。
 */
export const createBaselinePortraitQa = (
  spec: { width: number; height: number } = DEFAULT_PORTRAIT_SPEC,
): PortraitQa => ({
  evaluate: async ({ pose, image }) => {
    const results: QaCheckResult[] = []
    const header = parsePngHeader(image)

    if (header) {
      results.push({ checkId: 'spec-format-png', pose, status: 'pass' })
      results.push(
        header.width === spec.width && header.height === spec.height
          ? { checkId: 'spec-dimensions', pose, status: 'pass' }
          : {
              checkId: 'spec-dimensions',
              pose,
              status: 'fail',
              message: `期望 ${spec.width}×${spec.height}，实际 ${header.width}×${header.height}`,
            },
      )
      results.push(
        pngHasAlpha(header)
          ? { checkId: 'spec-alpha-channel', pose, status: 'pass' }
          : {
              checkId: 'spec-alpha-channel',
              pose,
              status: 'fail',
              message: `透明背景要求 alpha 通道，实际 colorType=${header.colorType}（抠图后处理疑似缺失）`,
            },
      )
    } else {
      const message = '产出不是合法 PNG（无法解析签名与 IHDR）'
      results.push({ checkId: 'spec-format-png', pose, status: 'fail', message })
      results.push({ checkId: 'spec-dimensions', pose, status: 'fail', message })
      results.push({
        checkId: 'spec-alpha-channel',
        pose,
        status: 'fail',
        message,
      })
    }

    for (const check of SEMANTIC_CHECKS) {
      results.push({
        checkId: check.checkId,
        pose,
        status: 'not_implemented',
        message: check.message,
      })
    }
    return results
  },
})
