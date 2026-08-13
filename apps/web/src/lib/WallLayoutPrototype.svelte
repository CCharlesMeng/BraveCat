<!--
  PROTOTYPE — 用后即弃。
  首屏明信片陈列布局的 dev-only 低保真渲染。
  定案布局与透视原理解读图共用同一几何；变体数据见 wallLayoutPrototype.ts。
  结论确认后连同该文件一起删除。
-->
<script lang="ts">
  import { CLASSIC_V4_FORM, displayCanvasStyle } from './homeTheme'
  import {
    WALL_PERSPECTIVE,
    WALL_PROTOTYPE_VARIANT_KEYS,
    wallPrototypeVariants,
    type WallPrototypeSlot,
    type WallPrototypeVariantKey,
  } from './wallLayoutPrototype'

  type WallPrototypePostcard = {
    id: string
    sceneSrc: string
    name: string
  }

  let { initialVariantKey, postcards }: {
    initialVariantKey: WallPrototypeVariantKey
    postcards: readonly WallPrototypePostcard[]
  } = $props()

  // svelte-ignore state_referenced_locally -- 初始值来自 URL，之后由组件内切换接管。
  let variantKey = $state(initialVariantKey)
  // svelte-ignore state_referenced_locally -- 原理解读默认显示标注，干净布局默认隐藏。
  let showGuides = $state(initialVariantKey === 'g')

  const variant = $derived(wallPrototypeVariants[variantKey])
  const { nearJambX, farCornerX } = WALL_PERSPECTIVE

  const applyVariant = (key: WallPrototypeVariantKey) => {
    variantKey = key
    showGuides = key === 'g'
    const url = new URL(window.location.href)
    url.searchParams.set('wallProto', key)
    window.history.replaceState(window.history.state, '', url)
    // 交接用：把当前变体的几何数据打到控制台，便于回填正式实现。
    console.log('[wallProto]', key, wallPrototypeVariants[key].slots)
  }

  const cycleVariant = (step: number) => {
    const index = WALL_PROTOTYPE_VARIANT_KEYS.indexOf(variantKey)
    const count = WALL_PROTOTYPE_VARIANT_KEYS.length
    applyVariant(WALL_PROTOTYPE_VARIANT_KEYS[(index + step + count) % count])
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable]')) return
    event.preventDefault()
    cycleVariant(event.key === 'ArrowLeft' ? -1 : 1)
  }

  type Quad = WallPrototypeSlot['quad']

  const quadPoints = (quad: Quad) =>
    quad.map(([x, y]) => `${x},${y}`).join(' ')

  const quadCenter = (quad: Quad) => ({
    x: quad.reduce((sum, [x]) => sum + x, 0) / 4,
    y: quad.reduce((sum, [, y]) => sum + y, 0) / 4,
  })
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="wall-proto home-display-canvas" aria-hidden="true">
  <svg
    class="wall-proto-svg wall-proto-decor"
    viewBox="0 0 1200 1600"
    preserveAspectRatio="none"
  >
    {#each variant.decor as decor}
      {#if decor.kind === 'line'}
        <line
          x1={decor.x1}
          y1={decor.y1}
          x2={decor.x2}
          y2={decor.y2}
          stroke={decor.color}
          stroke-width={decor.width}
          stroke-dasharray={decor.dash}
          stroke-linecap="round"
        />
      {:else if decor.kind === 'rect'}
        <rect
          x={decor.x}
          y={decor.y}
          width={decor.width}
          height={decor.height}
          rx={decor.radius ?? 0}
          fill={decor.fill}
          stroke={decor.stroke}
          stroke-width={decor.strokeWidth ?? 0}
        />
      {:else if decor.kind === 'polygon'}
        <polygon
          points={decor.points.map(([x, y]) => `${x},${y}`).join(' ')}
          fill={decor.fill}
          stroke={decor.stroke}
          stroke-width={decor.strokeWidth ?? 0}
          stroke-dasharray={decor.dash}
        />
      {:else if decor.kind === 'text'}
        <text
          x={decor.x}
          y={decor.y}
          class="wall-proto-guide-text"
          style={decor.color ? `fill: ${decor.color}` : undefined}
        >{decor.text}</text>
      {:else}
        <circle cx={decor.cx} cy={decor.cy} r={decor.r} fill={decor.fill} />
      {/if}
    {/each}
  </svg>

  {#each variant.slots as slot, index (variantKey + index)}
    {@const postcard = postcards[index]}
    <div
      class="wall-proto-slot"
      style={displayCanvasStyle(CLASSIC_V4_FORM.canvas, slot)}
    >
      {#if postcard}
        <img src={postcard.sceneSrc} alt="" />
      {:else}
        <span class="wall-proto-empty">{index + 1}</span>
      {/if}
    </div>
  {/each}

  <svg
    class="wall-proto-svg"
    viewBox="0 0 1200 1600"
    preserveAspectRatio="none"
  >
    {#each variant.slots as slot (quadPoints(slot.quad))}
      {#if variant.frameStyle === 'wood'}
        <polygon
          points={quadPoints(slot.quad)}
          fill="none"
          stroke="#8a6f4f"
          stroke-width="7"
        />
        <polygon
          points={quadPoints(slot.quad)}
          fill="none"
          stroke="rgba(255, 250, 235, 0.55)"
          stroke-width="2"
        />
      {:else}
        <polygon
          points={quadPoints(slot.quad)}
          fill="none"
          stroke="#fdf9ef"
          stroke-width="6"
        />
        <polygon
          points={quadPoints(slot.quad)}
          fill="none"
          stroke="rgba(73, 69, 53, 0.25)"
          stroke-width="1.5"
        />
      {/if}
    {/each}

    {#if showGuides}
      <line
        x1={nearJambX}
        y1="60"
        x2={nearJambX}
        y2="1080"
        stroke="rgba(43, 92, 138, 0.55)"
        stroke-width="3"
        stroke-dasharray="14 10"
      />
      <text
        x={nearJambX + 8}
        y="92"
        class="wall-proto-guide-text"
      >近端窗套 x≈{nearJambX}</text>

      <line
        x1={farCornerX}
        y1="60"
        x2={farCornerX}
        y2="1080"
        stroke="rgba(118, 80, 145, 0.62)"
        stroke-width="3"
        stroke-dasharray="14 10"
      />
      <text
        x={farCornerX - 178}
        y="126"
        class="wall-proto-guide-text corner"
      >远端内角 x≈{farCornerX}</text>

      <!-- 花瓶与绿植的避让区。 -->
      <polygon
        points="1020,680 1180,680 1180,995 1020,995"
        fill="rgba(178, 82, 74, 0.08)"
        stroke="rgba(178, 82, 74, 0.5)"
        stroke-width="2.5"
        stroke-dasharray="10 8"
      />
      <text x="1026" y="712" class="wall-proto-guide-text warn">避让：花瓶</text>

      <!-- 小猫活动区（各姿势位图的大致包络）。 -->
      <polygon
        points="20,480 470,480 470,1000 20,1000"
        fill="rgba(90, 122, 82, 0.06)"
        stroke="rgba(90, 122, 82, 0.5)"
        stroke-width="2.5"
        stroke-dasharray="10 8"
      />
      <text x="28" y="512" class="wall-proto-guide-text cat">避让：小猫</text>

      {#each variant.slots as slot, index (quadPoints(slot.quad))}
        {@const center = quadCenter(slot.quad)}
        <text
          x={center.x}
          y={center.y + 10}
          text-anchor="middle"
          class="wall-proto-guide-text badge"
        >{index + 1}</text>
      {/each}
    {/if}
  </svg>
</section>

<div class="wall-proto-bar">
  <p class="wall-proto-desc">{variant.summary}</p>
  <p class="wall-proto-note">{variant.layoutNote}</p>
  <div class="wall-proto-controls">
    <button type="button" onclick={() => cycleVariant(-1)} aria-label="上一个变体">←</button>
    <strong>{variantKey.toUpperCase()} — {variant.name}</strong>
    <button type="button" onclick={() => cycleVariant(1)} aria-label="下一个变体">→</button>
    <button
      type="button"
      class="wall-proto-toggle"
      class:active={showGuides}
      onclick={() => (showGuides = !showGuides)}
    >参考线</button>
  </div>
</div>

<style>
  .wall-proto {
    z-index: 7;
  }

  .wall-proto-slot {
    position: absolute;
    overflow: hidden;
    background: #f8efd8;
    filter: drop-shadow(2px 4px 3px rgba(73, 69, 53, 0.26));
  }

  .wall-proto-slot img,
  .wall-proto-empty {
    display: block;
    width: 112%;
    height: 118%;
    object-fit: cover;
    transform:
      translateY(-5%)
      skewY(var(--display-content-skew-y, 0deg))
      scale(1.04);
    transform-origin: 0 0;
  }

  .wall-proto-empty {
    display: grid;
    place-items: center;
    background: #ece2c7;
    color: #a89c7c;
    font-size: 0.8rem;
  }

  .wall-proto-svg {
    position: absolute;
    inset: 0;
    z-index: 30;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .wall-proto-decor {
    z-index: 0;
  }

  .wall-proto-guide-text {
    fill: #2b5c8a;
    paint-order: stroke;
    stroke: rgba(255, 253, 245, 0.85);
    stroke-width: 5;
    font-size: 26px;
    font-family: inherit;
  }

  .wall-proto-guide-text.warn {
    fill: #a04a42;
  }

  .wall-proto-guide-text.corner {
    fill: #765091;
  }

  .wall-proto-guide-text.cat {
    fill: #5a7a52;
  }

  .wall-proto-guide-text.badge {
    font-size: 24px;
  }

  .wall-proto-bar {
    position: fixed;
    bottom: 14px;
    left: 50%;
    z-index: 90;
    display: flex;
    max-width: min(92vw, 430px);
    align-items: center;
    flex-direction: column;
    gap: 3px;
    padding: 8px 16px;
    border-radius: 14px;
    background: rgba(28, 26, 21, 0.92);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    color: #f5f1e6;
    text-align: center;
    transform: translateX(-50%);
  }

  .wall-proto-desc {
    margin: 0;
    font-size: 0.72rem;
  }

  .wall-proto-note {
    margin: 0;
    opacity: 0.65;
    font-size: 0.62rem;
  }

  .wall-proto-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 3px;
  }

  .wall-proto-controls button {
    padding: 2px 10px;
    border: 1px solid rgba(245, 241, 230, 0.4);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .wall-proto-controls strong {
    font-size: 0.8rem;
    letter-spacing: 0.02em;
  }

  .wall-proto-toggle.active {
    background: rgba(245, 241, 230, 0.22);
  }
</style>
