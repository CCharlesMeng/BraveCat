<!--
  玩家侧家主题选择面板：base-plate 主题与按槽位的小猫用品为当前主路径；
  旧 form / finish / piece UI 标注 deprecated 但保留。只发出选择，持久化由调用方负责。
-->
<script lang="ts">
  import {
    customizationForHomeTheme,
    HOME_THEME_PRESETS,
    listCatItems,
    listCompatiblePieces,
    listHomeFinishes,
    listHomeForms,
    listHomeThemes,
    type CatItemSlot,
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
  const basePlateThemes = listHomeThemes().filter(
    (theme) => isDevelopment || theme.shippingEligible,
  )
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

  const catItemSlots: { slot: CatItemSlot, label: string }[] = [
    { slot: 'rest', label: '睡觉' },
    { slot: 'play', label: '玩耍' },
    { slot: 'scratch', label: '磨爪' },
    { slot: 'feed', label: '吃饭' },
  ]
  const catItemGroups = $derived(
    catItemSlots
      .map(({ slot, label }) => ({
        slot,
        label,
        options: listCatItems(slot),
      }))
      .filter(({ options }) => options.length > 0),
  )

  const activeThemeId = $derived(
    scene.homeThemeId ?? customization.homeThemeId ?? null,
  )

  const applyBasePlateTheme = (themeId: string) => {
    if (activeThemeId === themeId) return
    const next = customizationForHomeTheme(themeId)
    if (!next) return
    onApply({
      ...next,
      catItems: {
        ...next.catItems,
        // 切主题保留用品语义 ID（ADR-0010）。
        ...customization.catItems,
      },
    })
  }

  const applyPreset = (presetId: string) => {
    const preset = HOME_THEME_PRESETS.find(({ id }) => id === presetId)
    if (!preset || (scene.formId === preset.formId && !scene.homeThemeId)) return
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

  const applyCatItem = (slot: CatItemSlot, itemId: string) => {
    if (!activeThemeId) return
    if (customization.catItems?.[slot] === itemId) return
    const base = customization.homeThemeId === activeThemeId
      ? customization
      : customizationForHomeTheme(activeThemeId)
    if (!base) return
    onApply({
      ...base,
      homeThemeId: activeThemeId,
      catItems: { ...base.catItems, [slot]: itemId },
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
  {#if basePlateThemes.length > 0}
    <section>
      <h3>家主题</h3>
      <div class="theme-choice-row">
        {#each basePlateThemes as theme (theme.id)}
          <button
            type="button"
            class:active={activeThemeId === theme.id}
            disabled={activeThemeId === theme.id}
            onclick={() => applyBasePlateTheme(theme.id)}
          >{theme.name}</button>
        {/each}
      </div>
    </section>
  {/if}

  {#each catItemGroups as group (group.slot)}
    <section>
      <h3>小猫用品 · {group.label}</h3>
      <div class="theme-choice-row">
        {#each group.options as option (option.id)}
          <button
            type="button"
            class:active={customization.catItems?.[group.slot] === option.id
              || (scene.catItems.some(
                (item) => item.slot === group.slot && item.itemId === option.id,
              ))}
            disabled={!activeThemeId
              || customization.catItems?.[group.slot] === option.id}
            onclick={() => applyCatItem(group.slot, option.id)}
          >{option.name}</button>
        {/each}
      </div>
    </section>
  {/each}

  {#if presetOptions.length > 1}
    <section class="deprecated">
      <h3>主题（旧 form，deprecated）</h3>
      <div class="theme-choice-row">
        {#each presetOptions as preset (preset.id)}
          <button
            type="button"
            class:active={!scene.homeThemeId && scene.formId === preset.formId}
            disabled={!scene.homeThemeId && scene.formId === preset.formId}
            onclick={() => applyPreset(preset.id)}
          >{presetName(preset.formId)}</button>
        {/each}
      </div>
    </section>
  {/if}
  {#if !scene.homeThemeId && finishOptions.length > 1}
    <section class="deprecated">
      <h3>风格（deprecated）</h3>
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
    <section class="deprecated">
      <h3>{KIND_LABELS[row.kind] ?? row.kind}（deprecated）</h3>
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
    max-height: min(52vh, 420px);
    overflow: auto;
  }

  section {
    display: grid;
    gap: 5px;
  }

  section.deprecated {
    opacity: 0.72;
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

  .theme-choice-row button:disabled:not(.active) {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
