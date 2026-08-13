<script lang="ts">
  /**
   * 「用照片生成专属形象」流程视图：选照片 → 提交（余额与消耗提示）
   * → 状态进度轮询 → 10 姿势套图预览 → 确认 / 先不用。
   * 纯逻辑（校验与文案）在 portraitStudio.ts；只在云功能开启时挂载。
   */
  import { fade } from 'svelte/transition'
  import {
    CloudSyncError,
    type GenerationFailure,
    type GenerationJob,
    type PortraitPose,
    type UserPortrait,
  } from '@bravecat/core/cloud'
  import type { WebCloudSync } from './cloudSync.svelte'
  import {
    generationFailureText,
    generationStatusText,
    validatePortraitPhoto,
  } from './portraitStudio'

  type PoseUrls = Partial<Record<PortraitPose, string>>

  let {
    cloudSync,
    catName,
    onConfirmed,
    onClose,
  }: {
    cloudSync: WebCloudSync
    catName: string
    /** 确认成功：形象记录 + 各姿势的会话内预览 URL（调用方接管其生命周期）。 */
    onConfirmed: (portrait: UserPortrait, poseUrls: PoseUrls) => void
    onClose: () => void
  } = $props()

  type Phase = 'pick' | 'working' | 'preview' | 'confirming' | 'failed'

  let phase = $state<Phase>('pick')
  let photo = $state<{
    bytes: Uint8Array
    contentType: 'image/png' | 'image/jpeg'
    name: string
    previewUrl: string
  } | null>(null)
  let pickNotice = $state('')
  let statusText = $state('')
  let previewNotice = $state('')
  let failure = $state<GenerationFailure | undefined>(undefined)
  let job = $state<GenerationJob | null>(null)
  let posePreviews = $state<{ pose: PortraitPose; url: string }[]>([])
  /** 关闭面板后让轮询尽快收尾，不再更新任何状态。 */
  let cancelled = false
  /** 预览 URL 确认后交给调用方长期使用，不再由本组件回收。 */
  let previewsHandedOver = false

  const failureText = $derived(generationFailureText(failure))
  const balanceText = $derived(
    cloudSync.creditsBalance === null ? '——' : `${cloudSync.creditsBalance}`,
  )

  const errorMessage = (error: unknown): string =>
    error instanceof CloudSyncError
      ? error.message
      : '这次没能连上云端，请稍后再试。'

  const choosePhoto = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const verdict = validatePortraitPhoto(file)
    if (!verdict.ok) {
      pickNotice = verdict.message
      return
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    photo = {
      bytes,
      contentType: verdict.contentType,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }
    pickNotice = ''
  }

  const startGeneration = async () => {
    if (!photo || phase !== 'pick') return
    phase = 'working'
    failure = undefined
    try {
      statusText = '正在上传照片……'
      const photoKey = await cloudSync.portraits.upload({
        bytes: photo.bytes,
        contentType: photo.contentType,
      })

      statusText = '已提交，排队中……'
      const submitted = await cloudSync.portraits.submit({
        idempotencyKey: crypto.randomUUID(),
        photoKey,
      })
      job = submitted

      const settled = await cloudSync.portraits.wait(submitted.id, {
        intervalMs: 1_500,
        onUpdate: (next) => {
          job = next
          statusText = generationStatusText(next.status)
        },
        isCancelled: () => cancelled,
      })
      job = settled
      // 余额如实展示云端账本：提交预扣、失败退回都在这里反映出来。
      void cloudSync.refreshCreditsBalance()
      if (cancelled) return

      if (settled.status === 'failed') {
        failure = settled.failure
        phase = 'failed'
        return
      }
      if (settled.status !== 'awaiting_confirm' || !settled.result) {
        phase = 'failed'
        return
      }

      statusText = '正在取回 10 个姿势的预览……'
      const previews: { pose: PortraitPose; url: string }[] = []
      for (const pose of Object.keys(settled.result.poses) as PortraitPose[]) {
        const image = await cloudSync.portraits.poseImage(settled.id, pose)
        previews.push({
          pose,
          url: URL.createObjectURL(
            new Blob([image.bytes as BlobPart], { type: image.contentType }),
          ),
        })
        if (cancelled) return
      }
      posePreviews = previews
      phase = 'preview'
    } catch (error) {
      if (cancelled) return
      phase = 'pick'
      pickNotice = errorMessage(error)
    }
  }

  const confirmPortrait = async () => {
    if (!job || phase !== 'preview') return
    phase = 'confirming'
    previewNotice = ''
    try {
      const result = await cloudSync.portraits.confirm(job.id)
      void cloudSync.refreshCreditsBalance()
      previewsHandedOver = true
      onConfirmed(
        result.portrait,
        Object.fromEntries(
          posePreviews.map(({ pose, url }) => [pose, url]),
        ) as PoseUrls,
      )
      onClose()
    } catch (error) {
      phase = 'preview'
      previewNotice = errorMessage(error)
    }
  }

  const close = () => {
    cancelled = true
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    if (!previewsHandedOver) {
      for (const { url } of posePreviews) URL.revokeObjectURL(url)
    }
    onClose()
  }

  const retry = () => {
    failure = undefined
    job = null
    phase = 'pick'
  }
</script>

<button
  class="portrait-studio-backdrop"
  type="button"
  aria-label="关闭形象生成"
  onclick={close}
  transition:fade={{ duration: 140 }}
></button>
<dialog open class="portrait-studio" aria-labelledby="portrait-studio-title">
  <header>
    <div>
      <p>为{catName}</p>
      <h2 id="portrait-studio-title">用照片生成专属形象</h2>
    </div>
    <button
      class="portrait-studio-close"
      type="button"
      aria-label="关闭形象生成"
      onclick={close}
    >×</button>
  </header>

  {#if phase === 'pick'}
    <div class="portrait-studio-body">
      <p class="portrait-studio-intro">
        选一张清晰的猫咪照片，云端会为{catName}画出 10 个姿势的专属形象。
      </p>
      <label class="portrait-studio-picker">
        {#if photo}
          <img src={photo.previewUrl} alt="已选择的照片预览" />
          <span>{photo.name}（点击可更换）</span>
        {:else}
          <span>选择照片（PNG / JPEG，3MB 以内）</span>
        {/if}
        <input
          type="file"
          accept="image/png,image/jpeg"
          onchange={choosePhoto}
        />
      </label>
      {#if pickNotice}
        <p class="portrait-studio-notice" role="status">{pickNotice}</p>
      {/if}
      <div class="portrait-studio-facts">
        <p>剩余生成次数：<strong>{balanceText}</strong></p>
        <p>
          生成一次占用 1 次生成次数：提交时先预扣，确认使用后才正式消耗；
          审核拒绝、生成失败或质检不过都会自动退回。
        </p>
      </div>
      <div class="portrait-studio-actions">
        <button
          type="button"
          class="primary"
          disabled={!photo}
          onclick={startGeneration}
        >开始生成</button>
        <button type="button" onclick={close}>先不了</button>
      </div>
    </div>
  {:else if phase === 'working'}
    <div class="portrait-studio-body">
      <p class="portrait-studio-progress" aria-live="polite">{statusText}</p>
      <p class="portrait-studio-intro">
        可以先去别处逛逛，这个小窗开着就好；画完会在这里等你确认。
      </p>
      <div class="portrait-studio-actions">
        <button type="button" onclick={close}>先关闭（不影响生成）</button>
      </div>
    </div>
  {:else if phase === 'preview' || phase === 'confirming'}
    <div class="portrait-studio-body">
      <p class="portrait-studio-intro">
        这就是{catName}的专属形象——10 个姿势都在这里。是它吗？
      </p>
      <ul class="portrait-studio-poses" aria-label="10 姿势套图预览">
        {#each posePreviews as preview (preview.pose)}
          <li>
            <img src={preview.url} alt={`姿势 ${preview.pose}`} />
            <span>{preview.pose}</span>
          </li>
        {/each}
      </ul>
      {#if previewNotice}
        <p class="portrait-studio-notice" role="status">{previewNotice}</p>
      {/if}
      <div class="portrait-studio-facts">
        <p>
          确认后正式消耗 1 次生成次数，新形象进入可选列表；
          换上后只对之后的旅行生效，已出发的旅行和已收藏的明信片保持原样。
        </p>
        <p>先不用的话，这套图不会进入列表；预扣次数的退回以云端账本为准。</p>
      </div>
      <div class="portrait-studio-actions">
        <button
          type="button"
          class="primary"
          disabled={phase === 'confirming'}
          onclick={confirmPortrait}
        >{phase === 'confirming' ? '正在确认……' : '就是它，确认使用'}</button>
        <button
          type="button"
          disabled={phase === 'confirming'}
          onclick={close}
        >先不用</button>
      </div>
    </div>
  {:else if phase === 'failed'}
    <div class="portrait-studio-body">
      <h3 class="portrait-studio-failure">{failureText.title}</h3>
      <p class="portrait-studio-intro">{failureText.detail}</p>
      <p class="portrait-studio-facts">
        剩余生成次数：<strong>{balanceText}</strong>
      </p>
      <div class="portrait-studio-actions">
        <button type="button" class="primary" onclick={retry}>再试一次</button>
        <button type="button" onclick={close}>先这样吧</button>
      </div>
    </div>
  {/if}
</dialog>
