<!--
  玩家侧家主题选择面板：主题预设整套采用，兼容的表面风格与部件可
  单独替换。生产环境只提供已放行（shippingEligible）的内容；开发
  环境展示全部预览内容。只发出选择，持久化由调用方负责。
-->
<script lang="ts">
  import {
    HOME_THEME_PRESETS,
    listCompatiblePieces,
    listHomeFinishes,
    listHomeForms,
    type HomeCustomization,
    type ResolvedHomeScene,
  } from '@bravecat/core/homeTheme'

  let { customization, scene, isDevelopment, onApply }: {
    customization: HomeCustomization
    scene: ResolvedHomeScene
    isDevelopment: boolean
    onApply: (customization: HomeCustomization) => void
  } = $props()

  const forms = listHomeForms()
  const presetOptions = HOME_THEME_PRESETS.filter(({ formId }) => (
    isDevelopment
    || forms.find(({ id }) => id === formId)?.shippingEligible
  ))
  const presetName = (formId: string) => (
    forms.find(({ id }) => id === formId)?.name ?? formId
  )

  const finishOptions = $derived(listHomeFinishes(scene.formId))
  const pieceRows = $derived(scene.pieces
    .map((pieceSelection) => ({
      ...pieceSelection,
      options: listCompatiblePieces(scene.formId, pieceSelection.socketId)
        .filter((piece) => isDevelopment || piece.shippingEligible),
    }))
    .filter(({ options }) => options.length > 1))

  const applyPreset = (presetId: string) => {
    const preset = HOME_THEME_PRESETS.find(({ id }) => id === presetId)
    if (!preset || scene.formId === preset.formId) return
    onApply({
      presetId: preset.id,
      formId: preset.formId,
      finishId: preset.finishId,
      pieces: preset.pieces,
    })
  }

  const applyFinish = (finishId: string) => {
    if (finishId === scene.finishId) return
    onApply({ ...customization, presetId: undefined, finishId })
  }

  const applyPiece = (socketId: string, pieceId: string) => {
    onApply({
      ...customization,
      presetId: undefined,
      pieces: { ...customization.pieces, [socketId]: pieceId },
    })
  }

  const KIND_LABELS: Record<string, string> = {
    'window-frame': '窗框',
    'postcard-display': '画框墙',
    scratcher: '猫爬架',
    'feeding-set': '食碗',
    cabinet: '柜子',
    rug: '地毯',
    plant: '植物',
  }
</script>

<div class="theme-choices" aria-label="布置家">
  {#if presetOptions.length > 1}
    <section>
      <h3>主题</h3>
      <div class="theme-choice-row">
        {#each presetOptions as preset (preset.id)}
          <button
            type="button"
            class:active={scene.formId === preset.formId}
            disabled={scene.formId === preset.formId}
            onclick={() => applyPreset(preset.id)}
          >{presetName(preset.formId)}</button>
        {/each}
      </div>
    </section>
  {/if}
  {#if finishOptions.length > 1}
    <section>
      <h3>风格</h3>
      <div class="theme-choice-row">
        {#each finishOptions as finish (finish.id)}
          <button
            type="button"
            class:active={scene.finishId === finish.id}
            disabled={scene.finishId === finish.id}
            onclick={() => applyFinish(finish.id)}
          >{finish.name}</button>
        {/each}
      </div>
    </section>
  {/if}
  {#each pieceRows as row (row.socketId)}
    <section>
      <h3>{KIND_LABELS[row.kind] ?? row.kind}</h3>
      <div class="theme-choice-row">
        {#each row.options as option (option.id)}
          <button
            type="button"
            class:active={row.pieceId === option.id}
            disabled={row.pieceId === option.id}
            onclick={() => applyPiece(row.socketId, option.id)}
          >{option.name}</button>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .theme-choices {
    position: absolute;
    z-index: 8;
    bottom: 102px;
    left: 50%;
    display: grid;
    width: min(calc(100% - 36px), 340px);
    gap: 8px;
    padding: 12px 14px;
    transform: translateX(-50%);
    border: 1px solid rgba(83, 88, 70, 0.22);
    border-radius: 18px;
    background: rgba(250, 247, 235, 0.96);
    box-shadow: 0 10px 26px rgba(60, 62, 48, 0.18);
  }

  section {
    display: grid;
    gap: 5px;
  }

  h3 {
    margin: 0;
    color: #6f7259;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .theme-choice-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .theme-choice-row button {
    min-height: 28px;
    padding: 4px 10px;
    border: 1px solid rgba(90, 103, 73, 0.28);
    border-radius: 999px;
    background: rgba(255, 252, 241, 0.75);
    color: var(--ink, #3c3e30);
    cursor: pointer;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.62rem;
  }

  .theme-choice-row button.active {
    border-color: rgba(90, 103, 73, 0.56);
    background: rgba(228, 234, 216, 0.92);
    cursor: default;
  }
</style>
