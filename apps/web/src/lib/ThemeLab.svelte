<!--
  Theme Lab — dev-only 家主题配置器。
  ?themeLab 挂载；支持旧 form 预设与 base-plate 主题（A/B/F），
  以及 ?catItems=slot:item,… 查询参数。仅改内存选择，不写存档。
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
    normalizeHomeCustomization,
    type CatItemSlot,
    type HomeCustomization,
    type ResolvedHomeScene,
  } from '@bravecat/core/homeTheme'

  let { selection, scene, onSelect }: {
    selection: HomeCustomization
    scene: ResolvedHomeScene
    onSelect: (selection: HomeCustomization) => void
  } = $props()

  const forms = listHomeForms()
  const basePlateThemes = listHomeThemes()
  let showGuides = $state(true)

  const applyPreset = (presetId: string) => {
    const preset = HOME_THEME_PRESETS.find(({ id }) => id === presetId)
    if (!preset) return
    onSelect({
      presetId: preset.id,
      formId: preset.formId,
      finishId: preset.finishId,
      pieces: preset.pieces,
    })
  }

  const applyBasePlateTheme = (themeId: string) => {
    const next = customizationForHomeTheme(themeId)
    if (!next) return
    onSelect({
      ...next,
      catItems: {
        ...next.catItems,
        ...selection.catItems,
      },
    })
  }

  const applyRetiredSelection = () => {
    onSelect({
      formId: 'retired-loft',
      finishId: 'retired-finish',
      pieces: { scratcher: 'retired-piece' },
    })
  }

  const applyPiece = (socketId: string, pieceId: string) => {
    onSelect({
      ...selection,
      presetId: undefined,
      homeThemeId: undefined,
      pieces: { ...selection.pieces, [socketId]: pieceId },
    })
  }

  const applyCatItem = (slot: CatItemSlot, itemId: string) => {
    const themeId = scene.homeThemeId ?? selection.homeThemeId
    if (!themeId) return
    const base = selection.homeThemeId === themeId
      ? selection
      : customizationForHomeTheme(themeId)
    if (!base) return
    onSelect({
      ...base,
      homeThemeId: themeId,
      catItems: { ...base.catItems, [slot]: itemId },
    })
  }

  const fallbackActive = $derived(
    normalizeHomeCustomization(selection) !== selection,
  )
  const finishOptions = $derived(listHomeFinishes(scene.formId))
  const catItemGroups = $derived(
    (['rest', 'play', 'scratch', 'feed'] as const)
      .map((slot) => ({ slot, options: listCatItems(slot) }))
      .filter(({ options }) => options.length > 0),
  )
</script>

<aside class="theme-lab-panel" aria-label="Theme Lab">
  <strong>Theme Lab</strong>
  <div class="theme-lab-row">
    {#each basePlateThemes as theme (theme.id)}
      <button
        type="button"
        class:active={scene.homeThemeId === theme.id}
        onclick={() => applyBasePlateTheme(theme.id)}
      >{theme.name}</button>
    {/each}
  </div>
  <div class="theme-lab-row">
    {#each forms as form (form.id)}
      <button
        type="button"
        class:active={!scene.homeThemeId && scene.formId === form.id}
        onclick={() => applyPreset(form.id)}
      >{form.name}</button>
    {/each}
    <button type="button" class="retired" onclick={applyRetiredSelection}>
      模拟下架主题
    </button>
  </div>
  {#each catItemGroups as group (group.slot)}
    <div class="theme-lab-socket">
      <span class="theme-lab-socket-kind">cat · {group.slot}</span>
      <div class="theme-lab-row">
        {#each group.options as option (option.id)}
          <button
            type="button"
            class:active={scene.catItems.some(
              (item) => item.slot === group.slot && item.itemId === option.id,
            )}
            onclick={() => applyCatItem(group.slot, option.id)}
          >{option.name}</button>
        {/each}
      </div>
    </div>
  {/each}
  {#if !scene.homeThemeId && finishOptions.length > 1}
    <div class="theme-lab-socket">
      <span class="theme-lab-socket-kind">finish</span>
      <div class="theme-lab-row">
        {#each finishOptions as finish (finish.id)}
          <button
            type="button"
            class:active={scene.finishId === finish.id}
            onclick={() => onSelect({
              ...selection,
              presetId: undefined,
              finishId: finish.id,
            })}
          >{finish.name}</button>
        {/each}
      </div>
    </div>
  {/if}
  {#each scene.pieces as pieceSelection (pieceSelection.socketId)}
    {@const options = listCompatiblePieces(
      scene.formId,
      pieceSelection.socketId,
    )}
    {#if options.length > 1}
      <div class="theme-lab-socket">
        <span class="theme-lab-socket-kind">{pieceSelection.kind}</span>
        <div class="theme-lab-row">
          {#each options as option (option.id)}
            <button
              type="button"
              class:active={pieceSelection.pieceId === option.id}
              onclick={() => applyPiece(pieceSelection.socketId, option.id)}
            >{option.name}</button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
  <label class="theme-lab-toggle">
    <input type="checkbox" bind:checked={showGuides} />
    显示投影参考
  </label>
  <dl>
    <dt>theme / form</dt>
    <dd>{scene.homeThemeId ?? scene.formId}</dd>
    <dt>cat items</dt>
    <dd>{scene.catItems.map(({ slot }) => slot).join(', ') || '—'}</dd>
    <dt>slots / anchors</dt>
    <dd>{scene.postcardDisplay.slots.length} / {scene.souvenirDisplay.anchors.length}</dd>
    <dt>backdrop / lighting</dt>
    <dd>{scene.backdrop.length} 层 / {scene.lighting ? '有' : '无'}</dd>
    <dt>可上线</dt>
    <dd>{scene.shippingEligible ? '是' : '否（dev 预览）'}</dd>
  </dl>
  {#if fallbackActive}
    <p class="theme-lab-fallback">选择包含已下架内容，已回退到预设默认值。</p>
  {/if}
</aside>

{#if showGuides}
  <div class="home-display-canvas theme-lab-guides" aria-hidden="true">
    {#each scene.postcardDisplay.slots as slot, index (index)}
      <span class="guide slot" style={slot.style}>{index + 1}</span>
    {/each}
    {#each scene.souvenirDisplay.anchors as anchor, index (index)}
      <span class="guide anchor" style={anchor.style}>纪</span>
    {/each}
    {#each scene.catItems as item (item.slot)}
      <span class="guide cat-item" style={item.style}>{item.slot}</span>
    {/each}
    <span class="guide treat" style={scene.treat.style}>鱼</span>
    <span class="guide cat" style={scene.cat.imageStyle}>猫</span>
  </div>
{/if}

<style>
  .theme-lab-panel {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 60;
    width: 240px;
    max-height: calc(100vh - 24px);
    overflow: auto;
    padding: 12px;
    border-radius: 12px;
    background: rgba(30, 34, 28, 0.88);
    color: #f2eddb;
    font-size: 12px;
    line-height: 1.5;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  }

  .theme-lab-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0;
  }

  .theme-lab-row button {
    padding: 4px 8px;
    border: 1px solid rgba(242, 237, 219, 0.4);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .theme-lab-row button.active {
    background: #879b70;
    border-color: #879b70;
    color: #1d211a;
  }

  .theme-lab-row button.retired {
    border-style: dashed;
    opacity: 0.85;
  }

  .theme-lab-socket {
    margin: 6px 0;
    padding-top: 6px;
    border-top: 1px solid rgba(242, 237, 219, 0.18);
  }

  .theme-lab-socket-kind {
    font-size: 11px;
    opacity: 0.7;
  }

  .theme-lab-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 8px 0 0;
  }

  dt {
    opacity: 0.7;
  }

  dd {
    margin: 0;
  }

  .theme-lab-fallback {
    margin: 8px 0 0;
    color: #f0c46c;
  }

  .theme-lab-guides {
    pointer-events: none;
    z-index: 40;
  }

  .guide {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed rgba(216, 102, 66, 0.9);
    color: rgba(216, 102, 66, 0.95);
    font-size: 14px;
    background: rgba(216, 102, 66, 0.08);
  }

  .guide.anchor {
    border-color: rgba(118, 80, 145, 0.9);
    color: rgba(118, 80, 145, 0.95);
  }

  .guide.treat {
    border-color: rgba(59, 111, 157, 0.9);
    color: rgba(59, 111, 157, 0.95);
  }

  .guide.cat {
    border-color: rgba(82, 122, 82, 0.85);
    color: rgba(82, 122, 82, 0.9);
    font-size: 18px;
  }

  .guide.cat-item {
    border-color: rgba(70, 130, 150, 0.9);
    color: rgba(70, 130, 150, 0.95);
    font-size: 11px;
  }
</style>
