/**
 * 「用照片生成专属形象」流程的纯逻辑：前端照片校验、状态与失败文案、
 * 已确认形象到素材目录条目的映射。视图接线见 PortraitStudio.svelte
 * 与 App.svelte；与网络/DOM 解耦，便于单测。
 */
import type { Portrait } from '@bravecat/core/assets'
import {
  MAX_PORTRAIT_PHOTO_BYTES,
  PORTRAIT_PHOTO_CONTENT_TYPES,
  type GenerationFailure,
  type GenerationJobStatus,
  type PortraitPhotoContentType,
  type UserPortrait,
} from '@bravecat/core/cloud'

export type PhotoValidationResult =
  | { ok: true; contentType: PortraitPhotoContentType }
  | { ok: false; message: string }

/** 文件选择后的前端校验：格式与大小；服务端仍按魔数复查。 */
export const validatePortraitPhoto = (file: {
  type: string
  size: number
}): PhotoValidationResult => {
  const contentType = PORTRAIT_PHOTO_CONTENT_TYPES.find(
    (allowed) => allowed === file.type,
  )
  if (!contentType) {
    return { ok: false, message: '请选择 PNG 或 JPEG 格式的照片。' }
  }
  if (file.size === 0) {
    return { ok: false, message: '这张照片是空文件，换一张试试。' }
  }
  if (file.size > MAX_PORTRAIT_PHOTO_BYTES) {
    const limitMb = Math.floor(MAX_PORTRAIT_PHOTO_BYTES / 1024 / 1024)
    return {
      ok: false,
      message: `照片不能超过 ${limitMb}MB，压缩一下再来吧。`,
    }
  }
  return { ok: true, contentType }
}

/** 生成 job 状态的玩家可读文案（进度展示）。 */
export const generationStatusText = (status: GenerationJobStatus): string => {
  switch (status) {
    case 'pending':
      return '排队中……'
    case 'moderating':
      return '照片审核中……'
    case 'generating':
      return '正在为小猫画 10 个姿势……'
    case 'qa':
      return '自动质检中……'
    case 'awaiting_confirm':
      return '画好了，等你确认。'
    case 'confirmed':
      return '已经确认使用。'
    case 'failed':
      return '这次没有成功。'
  }
}

/** 失败态的友好中文文案；三种失败都由服务端自动退回预扣次数。 */
export const generationFailureText = (
  failure: GenerationFailure | undefined,
): { title: string; detail: string } => {
  switch (failure?.reason) {
    case 'moderation_rejected':
      return {
        title: '照片没有通过内容审核',
        detail:
          '换一张清晰、只有猫咪的照片再试试。这次的生成次数已经自动退回。',
      }
    case 'qa_failed':
      return {
        title: '生成结果没有通过自动质检',
        detail:
          '为了保证形象质量，这套图没有交付。这次的生成次数已经自动退回。',
      }
    default:
      return {
        title: '生成服务这次没有成功',
        detail: '可能是服务暂时繁忙，稍后再试。这次的生成次数已经自动退回。',
      }
  }
}

/**
 * 云形象的稳定资产路径：「/ + 对象存储 key」。目录与明信片配方冻结
 * 此路径，会话内经 cloudAssetRegistry 解析为 blob URL。
 */
export const cloudPortraitAssetPath = (storageKey: string): string =>
  `/${storageKey}`

/** 目录要求非空 set revision（changeCatPortrait 校验）；云形象按记录 id 派生。 */
export const cloudPortraitSetRevision = (portraitId: string): string =>
  `aigc:${portraitId}`

export const cloudPortraitName = (index: number): string =>
  `专属形象 ${index + 1}`

/** 已确认形象记录 → 素材目录条目（poses 覆盖全部 10 姿势）。 */
export const toCatalogPortrait = (
  portrait: UserPortrait,
  name: string,
): Portrait => ({
  id: portrait.id,
  name,
  poses: Object.fromEntries(
    Object.entries(portrait.poses).map(([pose, storageKey]) => [
      pose,
      cloudPortraitAssetPath(storageKey),
    ]),
  ) as Portrait['poses'],
})
