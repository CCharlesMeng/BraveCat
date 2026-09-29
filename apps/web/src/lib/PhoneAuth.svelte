<script lang="ts">
  /**
   * 手机号绑定弹窗：手机号 → 发验证码（60s 冷却）→ 绑定。
   * 手机号已属其他账号（conflict）时切到冲突面板二选一：
   * 「切换到已有账号」（先备份本地进度再换用云端）/「保留当前进度」。
   * 模态结构与视觉沿用 PortraitStudio（backdrop button + dialog open）。
   */
  import { fade } from 'svelte/transition'
  import {
    CloudSyncError,
    type PhoneBindExistingAccount,
  } from '@bravecat/core/cloud'
  import type { WebCloudSync } from './cloudSync.svelte'

  let {
    cloudSync,
    onClose,
    reason,
  }: {
    cloudSync: WebCloudSync
    onClose: () => void
    /** 'generation'：从「生成专属形象」的 403 引导进来，头部提示场景。 */
    reason?: 'generation'
  } = $props()

  type Phase = 'form' | 'conflict' | 'done'

  let phase = $state<Phase>('form')
  let phoneNumber = $state('')
  let verificationCode = $state('')
  let notice = $state('')
  let sentNotice = $state('')
  let sendCooldown = $state(0)
  let sending = $state(false)
  let submitting = $state(false)
  let switching = $state(false)
  let conflictAccount = $state<PhoneBindExistingAccount | null>(null)
  let doneText = $state('')

  let cooldownTimer: number | null = null
  let closeTimer: number | null = null

  const canSubmit = $derived(
    phoneNumber.trim().length > 0 && verificationCode.trim().length === 6,
  )

  const errorMessage = (error: unknown): string =>
    error instanceof CloudSyncError
      ? error.message
      : '这次没能连上云端，请稍后再试。'

  const startCooldown = () => {
    sendCooldown = 60
    cooldownTimer = window.setInterval(() => {
      sendCooldown -= 1
      if (sendCooldown > 0 || cooldownTimer === null) return
      window.clearInterval(cooldownTimer)
      cooldownTimer = null
    }, 1_000)
  }

  const sendCode = async () => {
    if (sending || sendCooldown > 0) return
    if (!phoneNumber.trim()) {
      notice = '请先填写手机号。'
      return
    }
    sending = true
    notice = ''
    try {
      await cloudSync.requestSmsCode(phoneNumber.trim(), 'bind')
      sentNotice = '验证码已发送，10 分钟内有效。'
      startCooldown()
    } catch (error) {
      notice = errorMessage(error)
    } finally {
      sending = false
    }
  }

  /** 成功收尾：短暂展示结果后自动关闭（也可手动点「好的」）。 */
  const finishAndClose = (text: string) => {
    doneText = text
    phase = 'done'
    closeTimer = window.setTimeout(onClose, 2_400)
  }

  const submitBind = async () => {
    if (submitting || !canSubmit) return
    submitting = true
    notice = ''
    try {
      const result = await cloudSync.bindPhone(
        phoneNumber.trim(),
        verificationCode.trim(),
      )
      if (result.status === 'bound') {
        finishAndClose(`已绑定 ${result.maskedPhone}，换设备也不会丢进度了。`)
      } else {
        conflictAccount = result.existingAccount
        phase = 'conflict'
      }
    } catch (error) {
      notice = errorMessage(error)
    } finally {
      submitting = false
    }
  }

  const switchToExisting = async () => {
    if (switching) return
    switching = true
    notice = ''
    try {
      // 409 冲突不消费验证码，直接复用刚输入的同一组号码与验证码登录。
      await cloudSync.switchToPhoneAccount(
        phoneNumber.trim(),
        verificationCode.trim(),
      )
      finishAndClose('已切换到该手机号的账号。')
    } catch (error) {
      notice = errorMessage(error)
    } finally {
      switching = false
    }
  }

  const close = () => {
    // 提交/切换进行到一半时关闭会留下语义不明的状态，先不允许关。
    if (submitting || switching) return
    onClose()
  }

  const formatDate = (at: number) => new Date(at).toLocaleDateString('zh-CN')

  $effect(() => () => {
    if (cooldownTimer !== null) window.clearInterval(cooldownTimer)
    if (closeTimer !== null) window.clearTimeout(closeTimer)
  })
</script>

<button
  class="phone-auth-backdrop"
  type="button"
  aria-label="关闭手机号绑定"
  onclick={close}
  transition:fade={{ duration: 140 }}
></button>
<dialog open class="phone-auth" aria-labelledby="phone-auth-title">
  <header>
    <div>
      <p>换设备不丢进度</p>
      <h2 id="phone-auth-title">绑定手机号</h2>
    </div>
    <button
      class="phone-auth-close"
      type="button"
      aria-label="关闭手机号绑定"
      onclick={close}
    >×</button>
  </header>

  {#if phase === 'form'}
    <form
      class="phone-auth-body"
      onsubmit={(event) => {
        event.preventDefault()
        void submitBind()
      }}
    >
      {#if reason === 'generation'}
        <p class="phone-auth-reason" role="status">
          生成专属形象前需要先绑定手机号。
        </p>
      {/if}
      <p class="phone-auth-intro">
        绑定后这个家就跟着手机号走，换设备也能接着玩。
      </p>
      <label class="phone-auth-field">
        <span>手机号</span>
        <div class="phone-auth-send-row">
          <input
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="手机号"
            bind:value={phoneNumber}
          />
          <button
            type="button"
            disabled={sending || sendCooldown > 0}
            onclick={sendCode}
          >{sendCooldown > 0 ? `重新发送(${sendCooldown}s)` : '发送验证码'}</button>
        </div>
      </label>
      <label class="phone-auth-field">
        <span>验证码</span>
        <input
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="6 位验证码"
          bind:value={verificationCode}
        />
      </label>
      {#if sentNotice}
        <p class="phone-auth-sent" role="status">{sentNotice}</p>
      {/if}
      {#if notice}
        <p class="phone-auth-notice" role="status">{notice}</p>
      {/if}
      <div class="phone-auth-actions">
        <button
          type="submit"
          class="primary"
          disabled={submitting || !canSubmit}
        >{submitting ? '正在绑定……' : '绑定'}</button>
        <button type="button" onclick={close}>先不了</button>
      </div>
    </form>
  {:else if phase === 'conflict'}
    <div class="phone-auth-body">
      <p class="phone-auth-intro">
        这个手机号已经绑定了另一个账号。可以切换过去，也可以保留当前进度。
      </p>
      {#if conflictAccount}
        <dl class="phone-auth-conflict-facts">
          <div>
            <dt>创建时间</dt>
            <dd>{formatDate(conflictAccount.createdAt)}</dd>
          </div>
          <div>
            <dt>云端存档</dt>
            <dd>{conflictAccount.hasSave ? '有' : '暂无'}</dd>
          </div>
          <div>
            <dt>生成次数</dt>
            <dd>{conflictAccount.creditBalance}</dd>
          </div>
        </dl>
      {/if}
      <p class="phone-auth-intro">
        切换后，当前本地进度会先导出为备份文件，然后换用该账号的云端进度。
      </p>
      {#if notice}
        <p class="phone-auth-notice" role="status">{notice}</p>
      {/if}
      <div class="phone-auth-actions">
        <button
          type="button"
          class="primary"
          disabled={switching}
          onclick={switchToExisting}
        >{switching ? '正在切换……' : '切换到已有账号'}</button>
        <button
          type="button"
          disabled={switching}
          onclick={close}
        >保留当前进度</button>
      </div>
    </div>
  {:else}
    <div class="phone-auth-body">
      <p class="phone-auth-done" role="status">{doneText}</p>
      <div class="phone-auth-actions">
        <button type="button" class="primary" onclick={onClose}>好的</button>
      </div>
    </div>
  {/if}
</dialog>
